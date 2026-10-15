import { randomUUID } from "node:crypto";
import type { InsForgeClient } from "@insforge/sdk";
import { expect, test } from "@playwright/test";
import { admin, env } from "./support/backend";

// Suscripción vencida = solo lectura (2.5): con el SDK autenticado, un negocio vencido puede leer
// pero no insertar, editar ni borrar; get_business_access_state es la fuente del estado y del primer cobro.

type Row = Record<string, unknown> & { id: string };
type Owner = { userId: string; client: InsForgeClient; email: string };

const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
const DAY = 86_400_000;

async function adminRows(path: string) {
  return await (await admin(`database/records/${path}`)).json() as Row[];
}

async function updateBusiness(id: string, values: Record<string, unknown>) {
  await admin(`database/records/businesses?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(values) });
}

async function createOwner(label: string): Promise<Owner> {
  const email = `rls-${label}-${runId}@citadely.test`;
  const password = `Rls-${randomUUID()}`;
  await admin("auth/users?client_type=server", {
    method: "POST",
    body: JSON.stringify({ email, password, name: `RLS ${label}`, autoConfirm: true }),
  });
  // Import dinámico: el SDK es solo ESM y el loader de Playwright resolvería el import estático con require.
  const { createClient } = await import("@insforge/sdk");
  const client = createClient({ baseUrl: env("NEXT_PUBLIC_INSFORGE_BASE_URL"), anonKey: env("NEXT_PUBLIC_INSFORGE_ANON_KEY") });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user) throw new Error(`No se pudo iniciar sesión: ${error?.message ?? "sin usuario"}`);
  return { userId: data.user.id, client, email };
}

let owner: Owner;
let stranger: Owner;
let business: Row;
let service: Row;
let slot: Row;
let client: Row;
let appointmentId: string;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  owner = await createOwner("owner");
  stranger = await createOwner("stranger");

  const created = await owner.client.database.from("businesses")
    .insert([{ owner_id: owner.userId, name: `RLS ${runId}`, slug: `rls-${runId}`, category: "otros" }])
    .select("*").single();
  expect(created.error).toBeNull();
  business = created.data as Row;

  const createdService = await owner.client.database.from("services").insert([{
    business_id: business.id,
    name: "Servicio RLS",
    duration_minutes: 30,
    price_cents: 100_000,
    requires_payment: true,
    deposit_type: "deposit",
    deposit_value_cents: 20_000,
  }]).select("*").single();
  expect(createdService.error).toBeNull();
  service = createdService.data as Row;

  const startsAt = new Date(Math.ceil((Date.now() + 3 * DAY) / 3_600_000) * 3_600_000);
  const createdSlot = await owner.client.database.from("service_availability_slots").insert([{
    business_id: business.id,
    service_id: service.id,
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + 30 * 60_000).toISOString(),
    capacity: 2,
    is_active: true,
  }]).select("*").single();
  expect(createdSlot.error).toBeNull();
  slot = createdSlot.data as Row;

  const createdClient = await owner.client.database.from("clients")
    .insert([{ business_id: business.id, name: "Cliente RLS", email: `cliente-${runId}@citadely.test` }])
    .select("*").single();
  expect(createdClient.error).toBeNull();
  client = createdClient.data as Row;

  const manual = await owner.client.database.rpc("create_manual_appointment", {
    p_business_id: business.id,
    p_client_id: client.id,
    p_service_id: service.id,
    p_starts_at: slot.starts_at,
  });
  expect(manual.error).toBeNull();
  appointmentId = String(manual.data);
});

test.afterAll(async () => {
  if (business?.id) await admin(`database/records/businesses?id=eq.${business.id}`, { method: "DELETE" }).catch(() => undefined);
  const userIds = [owner?.userId, stranger?.userId].filter(Boolean);
  if (userIds.length) await admin("auth/users", { method: "DELETE", body: JSON.stringify({ userIds }) }).catch(() => undefined);
});

test("negocio en prueba: escribe, y otro dueño no ve ni consulta su estado", async () => {
  const state = await owner.client.database.rpc("get_business_access_state", { p_business_id: business.id });
  expect(state.error).toBeNull();
  expect(state.data).toMatchObject({ has_dashboard_access: true, needs_payment: false, is_trialing: true, has_pro_features: true });

  const updated = await owner.client.database.from("services").update({ name: "Servicio RLS editado" }).eq("id", service.id).select("id");
  expect(updated.error).toBeNull();
  expect(updated.data).toHaveLength(1);

  const foreignState = await stranger.client.database.rpc("get_business_access_state", { p_business_id: business.id });
  expect(foreignState.error).not.toBeNull();
  // services es de lectura pública cuando la página está publicada; clients es privada.
  const foreignClients = await stranger.client.database.from("clients").select("id").eq("business_id", business.id);
  expect(foreignClients.data ?? []).toHaveLength(0);
  const foreignUpdate = await stranger.client.database.from("services").update({ name: "ajeno" }).eq("id", service.id).select("id");
  expect(foreignUpdate.data ?? []).toHaveLength(0);
});

test("negocio vencido: lee todo pero no inserta, edita ni borra", async () => {
  await updateBusiness(business.id, { subscription_status: "expired", trial_ends_at: new Date(Date.now() - DAY).toISOString() });

  const state = await owner.client.database.rpc("get_business_access_state", { p_business_id: business.id });
  expect(state.error).toBeNull();
  expect(state.data).toMatchObject({ has_dashboard_access: false, needs_payment: true, is_trialing: false, has_pro_features: false, public_page_published: false });

  for (const table of ["businesses", "services", "service_availability_slots", "clients", "appointments"]) {
    const column = table === "businesses" ? "id" : "business_id";
    const read = await owner.client.database.from(table).select("id").eq(column, business.id);
    expect(read.error, table).toBeNull();
    expect(read.data?.length, table).toBeGreaterThan(0);
  }

  const insertService = await owner.client.database.from("services").insert([{ business_id: business.id, name: "No permitido", duration_minutes: 30, price_cents: 0 }]).select("id");
  expect(insertService.error).not.toBeNull();
  const insertClient = await owner.client.database.from("clients").insert([{ business_id: business.id, name: "No permitido" }]).select("id");
  expect(insertClient.error).not.toBeNull();
  const insertSlot = await owner.client.database.from("service_availability_slots").insert([{
    business_id: business.id,
    service_id: service.id,
    starts_at: new Date(Date.now() + 5 * DAY).toISOString(),
    ends_at: new Date(Date.now() + 5 * DAY + 30 * 60_000).toISOString(),
    capacity: 1,
  }]).select("id");
  expect(insertSlot.error).not.toBeNull();

  // UPDATE y DELETE bloqueados por USING no fallan: no afectan filas. Se verifica contra la base.
  for (const [table, values] of [
    ["services", { name: "Editado vencido" }],
    ["service_availability_slots", { capacity: 9 }],
    ["clients", { name: "Editado vencido" }],
    ["appointments", { status: "cancelled" }],
    ["businesses", { name: "Editado vencido" }],
  ] as const) {
    const id = { services: service.id, service_availability_slots: slot.id, clients: client.id, appointments: appointmentId, businesses: business.id }[table];
    const result = await owner.client.database.from(table).update(values).eq("id", id).select("id");
    expect(result.data ?? [], `update ${table}`).toHaveLength(0);
    const [stored] = await adminRows(`${table}?id=eq.${id}&select=*`);
    for (const [key, value] of Object.entries(values)) expect(stored[key], `update ${table}.${key}`).not.toBe(value);
  }

  for (const [table, id] of [["services", service.id], ["service_availability_slots", slot.id], ["clients", client.id], ["appointments", appointmentId]] as const) {
    const result = await owner.client.database.from(table).delete().eq("id", id).select("id");
    expect(result.data ?? [], `delete ${table}`).toHaveLength(0);
    expect(await adminRows(`${table}?id=eq.${id}&select=id`), `delete ${table}`).toHaveLength(1);
  }

  const deposit = await owner.client.database.rpc("confirm_appointment_deposit", { p_appointment_id: appointmentId });
  expect(deposit.error).not.toBeNull();
  const [appointment] = await adminRows(`appointments?id=eq.${appointmentId}&select=status`);
  expect(appointment.status).toBe("pending_payment");

  const manual = await owner.client.database.rpc("create_manual_appointment", {
    p_business_id: business.id,
    p_client_id: client.id,
    p_service_id: service.id,
    p_starts_at: slot.starts_at,
  });
  expect(manual.error).not.toBeNull();

  const sections = await owner.client.database.rpc("sync_business_public_sections", { p_business_id: business.id, p_gallery_images: [], p_faqs: [] });
  expect(sections.error).not.toBeNull();
});

test("pago aprobado devuelve la escritura", async () => {
  await updateBusiness(business.id, {
    subscription_status: "active",
    subscription_provider: "mercadopago",
    subscription_current_period_end: new Date(Date.now() + 30 * DAY).toISOString(),
  });
  const deposit = await owner.client.database.rpc("confirm_appointment_deposit", { p_appointment_id: appointmentId });
  expect(deposit.error).toBeNull();
  const [appointment] = await adminRows(`appointments?id=eq.${appointmentId}&select=status`);
  expect(appointment.status).toBe("confirmed");
  const updated = await owner.client.database.from("businesses").update({ name: `RLS ${runId} pago` }).eq("id", business.id).select("id");
  expect(updated.data).toHaveLength(1);
});

test("el primer cobro espera el fin del código y no el fin de la prueba", async () => {
  const trialEndsAt = new Date(Date.now() + 7 * DAY).toISOString();
  const promotionEndsAt = new Date(Date.now() + 30 * DAY).toISOString();
  const billingStart = async () => {
    const { data, error } = await owner.client.database.rpc("get_business_access_state", { p_business_id: business.id });
    expect(error).toBeNull();
    return (data as { billing_start_at: string | null }).billing_start_at;
  };
  const same = (left: string | null, right: string) => expect(left && new Date(left).toISOString()).toBe(new Date(right).toISOString());

  await updateBusiness(business.id, {
    subscription_status: "trialing",
    subscription_provider: null,
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
    trial_ends_at: trialEndsAt,
    promotion_starts_at: new Date(Date.now() - DAY).toISOString(),
    promotion_ends_at: promotionEndsAt,
  });
  same(await billingStart(), promotionEndsAt);

  await updateBusiness(business.id, { promotion_starts_at: null, promotion_ends_at: null });
  same(await billingStart(), trialEndsAt);

  await updateBusiness(business.id, { trial_ends_at: new Date(Date.now() - DAY).toISOString() });
  expect(await billingStart()).toBeNull();
});

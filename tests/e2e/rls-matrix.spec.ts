import { randomUUID } from "node:crypto";
import type { InsForgeClient } from "@insforge/sdk";
import { expect, test } from "@playwright/test";
import { admin, env } from "./support/backend";

// Matriz de acceso (7.3): qué puede hacer cada actor sobre cada tabla y RPC del esquema public.
// Actores: anon (anon key), owner (dueño del negocio A, en prueba), other (dueño de B, intenta tocar A) y
// expired (dueño de C con la suscripción vencida, solo lectura). Datos propios por corrida, se borran al final.
// Las escrituras bloqueadas por USING no fallan: afectan 0 filas, así que se verifican contra la base con admin.

type Row = Record<string, unknown> & { id: string };
type Actor = "anon" | "owner" | "other" | "expired";
type SelectOutcome = "rows" | "none";

const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;
const DAY = 86_400_000;
const password = `Rls-${randomUUID()}`;
const userIds: string[] = [];
const businessIds: string[] = [];
const clients: Partial<Record<Actor, InsForgeClient>> = {};

// Filas del negocio A (y C para las pruebas de solo lectura), creadas en beforeAll.
const A: Record<string, string> = {};
const C: Record<string, string> = {};

async function adminRows(path: string) {
  return await (await admin(`database/records/${path}`)).json() as Row[];
}

async function sdk() {
  // Import dinámico: el SDK es solo ESM y el loader de Playwright resolvería el import estático con require.
  const { createClient } = await import("@insforge/sdk");
  return createClient({ baseUrl: env("NEXT_PUBLIC_INSFORGE_BASE_URL"), anonKey: env("NEXT_PUBLIC_INSFORGE_ANON_KEY") });
}

async function createOwner(label: string) {
  const email = `rls-matrix-${label}-${runId}@citadely.test`;
  await admin("auth/users?client_type=server", {
    method: "POST",
    body: JSON.stringify({ email, password, name: `RLS ${label}`, autoConfirm: true }),
  });
  const client = await sdk();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.user) throw new Error(`No se pudo iniciar sesión (${label}): ${error?.message ?? "sin usuario"}`);
  userIds.push(data.user.id);
  return { client, userId: data.user.id };
}

function ok(result: { error: unknown }, what: string) {
  if (result.error) throw new Error(`${what}: ${JSON.stringify(result.error)}`);
}

function must<T>(result: { data: T | null; error: unknown }, what: string): T {
  if (result.error || result.data == null) throw new Error(`${what}: ${JSON.stringify(result.error)}`);
  return result.data;
}

async function seedBusiness(client: InsForgeClient, userId: string, label: string, target: Record<string, string>) {
  const business = must(await client.database.from("businesses")
    .insert([{ owner_id: userId, name: `RLS ${label} ${runId}`, slug: `rls-matrix-${label}-${runId}`, category: "otros" }])
    .select("id").single(), `negocio ${label}`) as Row;
  target.business = business.id;
  businessIds.push(business.id);

  const service = must(await client.database.from("services").insert([{
    business_id: business.id, name: "Servicio activo", duration_minutes: 30, price_cents: 100_000,
    requires_payment: false, deposit_type: "free", deposit_value_cents: 0, is_active: true,
  }]).select("id").single(), `servicio ${label}`) as Row;
  target.service = service.id;
  const hidden = must(await client.database.from("services").insert([{
    business_id: business.id, name: "Servicio pausado", duration_minutes: 30, price_cents: 100_000,
    requires_payment: false, deposit_type: "free", deposit_value_cents: 0, is_active: false,
  }]).select("id").single(), `servicio pausado ${label}`) as Row;
  target.hiddenService = hidden.id;

  const startsAt = new Date(Math.ceil((Date.now() + 4 * DAY) / 3_600_000) * 3_600_000);
  target.slotStartsAt = startsAt.toISOString();
  const slot = must(await client.database.from("service_availability_slots").insert([{
    business_id: business.id, service_id: service.id, starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + 30 * 60_000).toISOString(), capacity: 2, is_active: true,
  }]).select("id").single(), `slot ${label}`) as Row;
  target.slot = slot.id;

  const client1 = must(await client.database.from("clients")
    .insert([{ business_id: business.id, name: "Cliente RLS", email: `cliente-${label}-${runId}@citadely.test` }])
    .select("id").single(), `cliente ${label}`) as Row;
  target.client = client1.id;

  target.appointment = String(must(await client.database.rpc("create_manual_appointment", {
    p_business_id: business.id, p_client_id: client1.id, p_service_id: service.id, p_starts_at: startsAt.toISOString(),
  }), `turno ${label}`));

  ok(await client.database.rpc("sync_business_public_sections", {
    p_business_id: business.id,
    p_gallery_images: [{ image_url: "https://example.com/rls.png", image_key: `rls/${runId}.png` }],
    p_faqs: [{ question: "¿Pregunta?", answer: "Respuesta." }],
  }), `secciones ${label}`);

  ok(await client.database.from("business_notification_settings")
    .upsert([{ business_id: business.id, email: `aviso-${label}-${runId}@citadely.test` }], { onConflict: "business_id" })
    .select("business_id"), `avisos ${label}`);

  const employee = must(await client.database.from("employees")
    .insert([{ business_id: business.id, name: "Profesional", is_active: true }]).select("id").single(), `empleado ${label}`) as Row;
  target.employee = employee.id;
  const hours = must(await client.database.from("working_hours").insert([{
    business_id: business.id, employee_id: employee.id, weekday: 1, start_time: "09:00", end_time: "18:00", is_active: true,
  }]).select("id").single(), `horario ${label}`) as Row;
  target.workingHours = hours.id;
  const timeOff = must(await client.database.from("time_off").insert([{
    business_id: business.id, employee_id: employee.id,
    starts_at: new Date(Date.now() + 10 * DAY).toISOString(), ends_at: new Date(Date.now() + 11 * DAY).toISOString(),
  }]).select("id").single(), `ausencia ${label}`) as Row;
  target.timeOff = timeOff.id;
  const note = must(await client.database.from("appointment_notes").insert([{
    business_id: business.id, appointment_id: target.appointment, note: "Nota privada",
  }]).select("id").single(), `nota ${label}`) as Row;
  target.note = note.id;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  test.setTimeout(120_000);
  const owner = await createOwner("owner");
  const other = await createOwner("other");
  const expired = await createOwner("expired");
  clients.anon = await sdk();
  clients.owner = owner.client;
  clients.other = other.client;
  clients.expired = expired.client;

  await seedBusiness(owner.client, owner.userId, "a", A);
  const otherBusiness = must(await other.client.database.from("businesses")
    .insert([{ owner_id: other.userId, name: `RLS b ${runId}`, slug: `rls-matrix-b-${runId}` }]).select("id").single(), "negocio b") as Row;
  businessIds.push(otherBusiness.id);
  await seedBusiness(expired.client, expired.userId, "c", C);
  await admin(`database/records/businesses?id=eq.${C.business}`, {
    method: "PATCH",
    body: JSON.stringify({ subscription_status: "expired", trial_ends_at: new Date(Date.now() - DAY).toISOString() }),
  });
});

test.afterAll(async () => {
  for (const id of businessIds) await admin(`database/records/businesses?id=eq.${id}`, { method: "DELETE" }).catch(() => undefined);
  if (userIds.length) await admin("auth/users", { method: "DELETE", body: JSON.stringify({ userIds }) }).catch(() => undefined);
});

async function selectOutcome(actor: Actor, table: string, column: string, value: string, columns = "id"): Promise<SelectOutcome> {
  const { data, error } = await clients[actor]!.database.from(table).select(columns).eq(column, value);
  return !error && (data?.length ?? 0) > 0 ? "rows" : "none";
}

// Lecturas: anon / owner / other sobre filas del negocio A (público, en prueba, plan Pro).
const READS: { table: string; column: string; key: string; columns?: string; expected: Record<"anon" | "owner" | "other", SelectOutcome> }[] = [
  { table: "businesses", column: "id", key: "business", columns: "id,name,slug", expected: { anon: "rows", owner: "rows", other: "none" } },
  { table: "businesses", column: "id", key: "business", columns: "id,subscription_status,subscription_external_id", expected: { anon: "none", owner: "rows", other: "none" } },
  { table: "services", column: "id", key: "service", expected: { anon: "rows", owner: "rows", other: "rows" } },
  { table: "services", column: "id", key: "hiddenService", expected: { anon: "none", owner: "rows", other: "none" } },
  { table: "service_availability_slots", column: "id", key: "slot", expected: { anon: "rows", owner: "rows", other: "rows" } },
  { table: "clients", column: "id", key: "client", expected: { anon: "none", owner: "rows", other: "none" } },
  { table: "appointments", column: "id", key: "appointment", expected: { anon: "none", owner: "rows", other: "none" } },
  { table: "business_gallery_images", column: "business_id", key: "business", expected: { anon: "rows", owner: "rows", other: "rows" } },
  { table: "business_faqs", column: "business_id", key: "business", expected: { anon: "rows", owner: "rows", other: "rows" } },
  { table: "business_notification_settings", column: "business_id", key: "business", columns: "business_id", expected: { anon: "none", owner: "rows", other: "none" } },
  { table: "employees", column: "id", key: "employee", expected: { anon: "rows", owner: "rows", other: "rows" } },
  { table: "working_hours", column: "id", key: "workingHours", expected: { anon: "rows", owner: "rows", other: "rows" } },
  { table: "time_off", column: "id", key: "timeOff", expected: { anon: "none", owner: "rows", other: "none" } },
  { table: "appointment_notes", column: "id", key: "note", expected: { anon: "none", owner: "rows", other: "none" } },
  { table: "subscription_payments", column: "business_id", key: "business", expected: { anon: "none", owner: "none", other: "none" } },
];

test("lecturas por tabla: anon, dueño y otro dueño", async () => {
  const failures: string[] = [];
  for (const read of READS) {
    for (const actor of ["anon", "owner", "other"] as const) {
      const outcome = await selectOutcome(actor, read.table, read.column, A[read.key], read.columns);
      if (outcome !== read.expected[actor]) failures.push(`${read.table}(${read.columns ?? "id"}) ${actor}: ${outcome}, esperado ${read.expected[actor]}`);
    }
  }
  expect(failures).toEqual([]);
});

test("tablas internas: ni anon ni usuarios autenticados leen o escriben", async () => {
  const internal = [
    "email_outbox", "email_webhook_events", "promo_codes", "promo_redemptions", "promo_redemption_attempts",
    "public_booking_attempts", "subscription_operations", "subscription_payments", "subscription_webhook_events",
    "blog_admin_login_attempts",
  ];
  const failures: string[] = [];
  for (const table of internal) {
    for (const actor of ["anon", "owner"] as const) {
      const read = await clients[actor]!.database.from(table).select("*").limit(1);
      if (!read.error && (read.data?.length ?? 0) > 0) failures.push(`${table} ${actor} lee filas`);
      const write = await clients[actor]!.database.from(table).insert([{ id: randomUUID() }]);
      if (!write.error) failures.push(`${table} ${actor} inserta`);
    }
  }
  expect(failures).toEqual([]);
});

test("contenido público: el blog solo expone lo publicado y nadie escribe", async () => {
  for (const actor of ["anon", "owner"] as const) {
    const drafts = await clients[actor]!.database.from("blog_posts").select("id").neq("status", "published");
    expect(drafts.data ?? [], actor).toHaveLength(0);
    expect((await clients[actor]!.database.from("blog_posts").insert([{ slug: `rls-${runId}`, title: "x" }])).error, actor).not.toBeNull();
  }
});

test("planes de suscripción: precios activos públicos, solo las columnas expuestas", async () => {
  const active = await adminRows("subscription_plans?is_active=eq.true&select=code");
  for (const actor of ["anon", "owner"] as const) {
    const plans = await clients[actor]!.database.from("subscription_plans").select("code,amount_cents,currency");
    expect(plans.error, `${actor}: ${JSON.stringify(plans.error)}`).toBeNull();
    // La política filtra los planes inactivos (precios viejos que siguen valiendo para suscriptores existentes).
    expect((plans.data as { code: string }[]).map((plan) => plan.code).sort(), actor).toEqual(active.map((plan) => plan.code).sort());
    expect((await clients[actor]!.database.from("subscription_plans").select("id,is_active")).error, `${actor} columnas internas`).not.toBeNull();
  }
  expect((await clients.owner!.database.from("subscription_plans").update({ amount_cents: 1 }).eq("code", "pro").select("code")).data ?? []).toHaveLength(0);
});

// Escrituras de otro dueño (B) y de anon sobre filas de A: nunca afectan nada.
const FOREIGN_WRITES: { table: string; key: string; values: Record<string, unknown>; insert: Record<string, unknown> }[] = [
  { table: "services", key: "service", values: { name: "ajeno" }, insert: { name: "ajeno", duration_minutes: 30, price_cents: 0 } },
  { table: "service_availability_slots", key: "slot", values: { capacity: 9 }, insert: { capacity: 1 } },
  { table: "clients", key: "client", values: { name: "ajeno" }, insert: { name: "ajeno" } },
  { table: "appointments", key: "appointment", values: { status: "cancelled" }, insert: {} },
  { table: "employees", key: "employee", values: { name: "ajeno" }, insert: { name: "ajeno" } },
  { table: "working_hours", key: "workingHours", values: { is_active: false }, insert: { weekday: 2, start_time: "09:00", end_time: "10:00" } },
  { table: "time_off", key: "timeOff", values: { reason: "ajeno" }, insert: {} },
  { table: "appointment_notes", key: "note", values: { note: "ajeno" }, insert: { note: "ajeno" } },
  { table: "business_gallery_images", key: "business", values: { sort_order: 9 }, insert: { image_url: "https://example.com/x.png", image_key: "x" } },
  { table: "business_faqs", key: "business", values: { answer: "ajeno" }, insert: { question: "x", answer: "x" } },
];

test("otro dueño y anon no insertan, editan ni borran filas de un negocio ajeno", async () => {
  const failures: string[] = [];
  for (const write of FOREIGN_WRITES) {
    const idColumn = write.key === "business" ? "business_id" : "id";
    const [before] = await adminRows(`${write.table}?${idColumn}=eq.${A[write.key]}&select=*&limit=1`);
    for (const actor of ["anon", "other"] as const) {
      const db = clients[actor]!.database;
      const inserted = await db.from(write.table).insert([{ business_id: A.business, ...write.insert }]).select("id");
      if (!inserted.error && (inserted.data?.length ?? 0) > 0) failures.push(`${write.table} ${actor} inserta`);
      const updated = await db.from(write.table).update(write.values).eq(idColumn, A[write.key]).select("id");
      if (!updated.error && (updated.data?.length ?? 0) > 0) failures.push(`${write.table} ${actor} edita`);
      const deleted = await db.from(write.table).delete().eq(idColumn, A[write.key]).select("id");
      if (!deleted.error && (deleted.data?.length ?? 0) > 0) failures.push(`${write.table} ${actor} borra`);
    }
    const [after] = await adminRows(`${write.table}?${idColumn}=eq.${A[write.key]}&select=*&limit=1`);
    if (JSON.stringify(after) !== JSON.stringify(before)) failures.push(`${write.table}: la fila cambió`);
  }

  // businesses: ni anon ni otro dueño editan o borran A, ni crean negocios a nombre de otro.
  const [businessBefore] = await adminRows(`businesses?id=eq.${A.business}&select=name,updated_at`);
  for (const actor of ["anon", "other"] as const) {
    await clients[actor]!.database.from("businesses").update({ name: "ajeno" }).eq("id", A.business);
    await clients[actor]!.database.from("businesses").delete().eq("id", A.business);
  }
  const ownerId = (await adminRows(`businesses?id=eq.${A.business}&select=owner_id`))[0].owner_id;
  const impersonation = await clients.other!.database.from("businesses").insert([{ owner_id: ownerId, name: "x", slug: `rls-x-${runId}` }]).select("id");
  if (!impersonation.error) failures.push("businesses other inserta a nombre de otro dueño");
  expect(await adminRows(`businesses?id=eq.${A.business}&select=name,updated_at`)).toEqual([businessBefore]);
  expect(failures).toEqual([]);
});

test("el dueño no toca columnas de facturación ni inserta turnos sin pasar por la RPC", async () => {
  const db = clients.owner!.database;
  const billing = await db.from("businesses").update({ subscription_status: "active", subscription_current_period_end: new Date(Date.now() + 365 * DAY).toISOString() }).eq("id", A.business);
  expect(billing.error).not.toBeNull();
  const [business] = await adminRows(`businesses?id=eq.${A.business}&select=subscription_status`);
  expect(business.subscription_status).toBe("trialing");

  const direct = await db.from("appointments").insert([{
    business_id: A.business, client_id: A.client, service_id: A.service,
    starts_at: A.slotStartsAt, ends_at: new Date(new Date(A.slotStartsAt).getTime() + 30 * 60_000).toISOString(),
  }]);
  expect(direct.error).not.toBeNull();
});

test("con la suscripción vencida el dueño lee pero no escribe en ninguna tabla del negocio", async () => {
  const db = clients.expired!.database;
  const failures: string[] = [];
  for (const [table, key, values] of [
    ["employees", "employee", { name: "editado" }],
    ["working_hours", "workingHours", { is_active: false }],
    ["time_off", "timeOff", { reason: "editado" }],
    ["appointment_notes", "note", { note: "editado" }],
    ["clients", "client", { name: "editado" }],
    ["services", "service", { name: "editado" }],
  ] as const) {
    if ((await selectOutcome("expired", table, "id", C[key])) !== "rows") failures.push(`${table}: no lee`);
    const updated = await db.from(table).update(values).eq("id", C[key]).select("id");
    if (!updated.error && (updated.data?.length ?? 0) > 0) failures.push(`${table}: edita`);
    const deleted = await db.from(table).delete().eq("id", C[key]).select("id");
    if (!deleted.error && (deleted.data?.length ?? 0) > 0) failures.push(`${table}: borra`);
  }
  const settings = await db.from("business_notification_settings").update({ email: `nuevo-${runId}@citadely.test` }).eq("business_id", C.business).select("business_id");
  if (!settings.error && (settings.data?.length ?? 0) > 0) failures.push("business_notification_settings: edita");
  if (!(await db.from("employees").insert([{ business_id: C.business, name: "nuevo" }])).error) failures.push("employees: inserta");
  expect(failures).toEqual([]);
});

// RPC expuestas: quién puede ejecutarlas y sobre qué negocio.
test("RPC de escritura: anon nunca; otro dueño nunca sobre un negocio ajeno; vencido nunca", async () => {
  const futureSlot = new Date(Math.ceil((Date.now() + 6 * DAY) / 3_600_000) * 3_600_000).toISOString();
  const upsertArgs = (businessId: string, serviceId: string) => ({
    p_business_id: businessId, p_service_id: serviceId, p_name: "Editado por RPC", p_description: "", p_image_url: "",
    p_duration_minutes: 30, p_price_cents: 100_000, p_deposit_type: "free", p_deposit_value_cents: 0,
    p_slots: [{ starts_at: futureSlot, capacity: 1 }],
    p_window_start: new Date().toISOString(), p_window_end: new Date(Date.now() + 60 * DAY).toISOString(),
  });
  const calls: { name: string; args: (target: Record<string, string>) => Record<string, unknown> }[] = [
    { name: "upsert_service_with_slots", args: (t) => upsertArgs(t.business, t.service) },
    { name: "create_manual_appointment", args: (t) => ({ p_business_id: t.business, p_client_id: t.client, p_service_id: t.service, p_starts_at: t.slotStartsAt }) },
    { name: "update_appointment_status", args: (t) => ({ p_appointment_id: t.appointment, p_status: "cancelled", p_reason: "rls" }) },
    { name: "confirm_appointment_deposit", args: (t) => ({ p_appointment_id: t.appointment }) },
    { name: "sync_business_public_sections", args: (t) => ({ p_business_id: t.business, p_gallery_images: [], p_faqs: [] }) },
    { name: "get_business_access_state", args: (t) => ({ p_business_id: t.business }) },
  ];
  const failures: string[] = [];
  for (const call of calls) {
    for (const [actor, target] of [["anon", A], ["other", A], ["expired", C]] as const) {
      if (actor === "expired" && call.name === "get_business_access_state") continue;
      const { error } = await clients[actor]!.database.rpc(call.name, call.args(target));
      if (!error) failures.push(`${call.name} ${actor}: se ejecutó`);
    }
  }
  const [appointment] = await adminRows(`appointments?id=eq.${A.appointment}&select=status`);
  expect(appointment.status).toBe("confirmed");
  const [service] = await adminRows(`services?id=eq.${C.service}&select=name`);
  expect(service.name).toBe("Servicio activo");
  expect(failures).toEqual([]);

  // El dueño con acceso sí puede (control positivo), conservando el horario que ya tiene una reserva.
  const ownerArgs = upsertArgs(A.business, A.service);
  ownerArgs.p_slots = [{ starts_at: A.slotStartsAt, capacity: 2 }, ...ownerArgs.p_slots];
  const { error } = await clients.owner!.database.rpc("upsert_service_with_slots", ownerArgs);
  expect(error, JSON.stringify(error)).toBeNull();
});

test("RPC internas: la reserva pública y su rate limit solo corren con la key de servidor", async () => {
  for (const actor of ["anon", "owner"] as const) {
    const booking = await clients[actor]!.database.rpc("create_public_booking", {
      p_business_id: A.business, p_service_id: A.service, p_starts_at: A.slotStartsAt,
      p_client_name: "Directo", p_client_email: `directo-${runId}@citadely.test`,
    });
    expect(booking.error, `create_public_booking ${actor}`).not.toBeNull();
    const attempt = await clients[actor]!.database.rpc("register_public_booking_attempt", {
      p_business_id: A.business, p_email: `x-${runId}@citadely.test`, p_phone: "1100000000",
    });
    expect(attempt.error, `register_public_booking_attempt ${actor}`).not.toBeNull();
    for (const name of ["apply_mercadopago_subscription_payment", "sync_business_subscription_status", "redeem_promo_code", "cancel_expired_deposit_bookings", "claim_email_outbox"]) {
      expect((await clients[actor]!.database.rpc(name, {})).error, `${name} ${actor}`).not.toBeNull();
    }
  }
  expect(await adminRows(`public_booking_attempts?business_id=eq.${A.business}&select=id`)).toEqual([]);
});

test("RPC públicas de lectura: la ocupación solo se informa para negocios con reservas habilitadas", async () => {
  const visible = await clients.anon!.database.rpc("get_public_slot_occupancy", { p_business_id: A.business, p_slot_ids: [A.slot] });
  expect(visible.error).toBeNull();
  expect((visible.data as unknown[]).length).toBe(1);
  const hidden = await clients.anon!.database.rpc("get_public_slot_occupancy", { p_business_id: C.business, p_slot_ids: [C.slot] });
  expect(hidden.error).toBeNull();
  expect(hidden.data ?? []).toEqual([]);
});

// Triggers de integridad que ningún camino (ni la key de servidor) puede saltear.
test("triggers: cupo del horario, cliente único por email y transiciones de estado", async () => {
  await expect(admin("database/records/appointments", {
    method: "POST",
    body: JSON.stringify([{
      business_id: A.business, client_id: A.client, service_id: A.service, status: "confirmed", source: "business",
      starts_at: new Date(Date.now() + 20 * DAY).toISOString(), ends_at: new Date(Date.now() + 20 * DAY + 30 * 60_000).toISOString(),
    }]),
  }), "la key de servidor no inserta turnos fuera de un horario publicado").rejects.toThrow(/habilitado|horario/i);

  // Cupo 2 con un turno ya tomado: el segundo entra, el tercero no.
  const second = await clients.owner!.database.from("clients").insert([{ business_id: A.business, name: "Segunda", email: `segunda-${runId}@citadely.test` }]).select("id").single();
  const third = await clients.owner!.database.from("clients").insert([{ business_id: A.business, name: "Tercera", email: `tercera-${runId}@citadely.test` }]).select("id").single();
  const seat = (clientId: string) => clients.owner!.database.rpc("create_manual_appointment", {
    p_business_id: A.business, p_client_id: clientId, p_service_id: A.service, p_starts_at: A.slotStartsAt,
  });
  expect((await seat((second.data as Row).id)).error).toBeNull();
  expect((await seat((third.data as Row).id)).error).not.toBeNull();

  const duplicate = await clients.owner!.database.from("clients").insert([{ business_id: A.business, name: "Duplicada", email: `CLIENTE-A-${runId}@citadely.test`.toUpperCase() }]);
  expect(duplicate.error, "email repetido con otras mayúsculas").not.toBeNull();

  // confirmed → pending_payment no es una transición válida, ni por RPC ni editando la fila.
  expect((await clients.owner!.database.rpc("update_appointment_status", { p_appointment_id: A.appointment, p_status: "pending_payment" })).error).not.toBeNull();
  const directUpdate = await clients.owner!.database.from("appointments").update({ status: "pending_payment" }).eq("id", A.appointment).select("id");
  expect(directUpdate.error).not.toBeNull();
  const [appointment] = await adminRows(`appointments?id=eq.${A.appointment}&select=status`);
  expect(appointment.status).toBe("confirmed");
});

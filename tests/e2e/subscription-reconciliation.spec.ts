import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { assertBackendBranch, readLinkedProject } from "../../scripts/lib/seed-guard.mjs";

// Reconciliación con Mercado Pago (2.7) contra tests/fixtures/mercadopago-mock.mjs. Crea su propio negocio y
// limita el cron con ?businessId=, así que no toca el negocio demo ni datos de otras corridas.

type Row = Record<string, unknown> & { id: string };
type Report = {
  businesses: number;
  synced: number;
  paymentsApplied: number;
  errors: { businessId: string; message: string }[];
  orphans: { cancelled: string[]; reported: { id: string; status: string }[]; searchError: string | null };
};

const MOCK_URL = process.env.E2E_MERCADOPAGO_MOCK_URL ?? "http://127.0.0.1:3010";
const CRON_SECRET = process.env.CRON_SECRET ?? "e2e-cron-secret";
const DAY = 86_400_000;
const runId = `${Date.now().toString(36)}-${randomUUID().slice(0, 6)}`;

function env(name: string) {
  if (process.env[name]) return process.env[name] as string;
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((candidate) => candidate.startsWith(`${name}=`));
  if (!line) throw new Error(`Falta ${name}.`);
  return line.slice(name.length + 1);
}

function branchProject() {
  const project = readLinkedProject() as { oss_host: string; api_key: string };
  assertBackendBranch(project);
  return project;
}

async function admin(path: string, init?: RequestInit) {
  const project = branchProject();
  const response = await fetch(`${project.oss_host}/api/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${project.api_key}`,
      "Content-Type": "application/json",
      "x-api-key": project.api_key,
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) throw new Error(`InsForge ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response;
}

async function adminRows(path: string) {
  return await (await admin(`database/records/${path}`)).json() as Row[];
}

async function mock(path: string, init?: RequestInit) {
  const response = await fetch(`${MOCK_URL}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`Mock ${response.status} en ${path}: ${(await response.text()).slice(0, 200)}`);
  return await response.json() as Row & { status: string };
}

async function createPreapproval(businessId: string, amount: number, extra: Record<string, unknown> = {}) {
  const created = await mock("/preapproval", {
    method: "POST",
    body: JSON.stringify({
      reason: "Citadely - Plan Pro",
      external_reference: businessId,
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: amount, currency_id: "ARS" },
      ...extra,
    }),
  });
  return created.id;
}

let userId = "";
let businessId = "";
let preapprovalId = "";
let nextPaymentDate = "";
let staleOrphanId = "";
let freshOrphanId = "";
let authorizedOrphanId = "";
let firstReport: Report;

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  const health = await fetch(`${MOCK_URL}/preapproval/search?status=pending&offset=0&limit=1`);
  if (!health.ok) throw new Error(`El mock de Mercado Pago en ${MOCK_URL} no soporta /preapproval/search; reinicialo.`);

  const email = `recon-${runId}@citadely.test`;
  const password = `Recon-${randomUUID()}`;
  await admin("auth/users?client_type=server", {
    method: "POST",
    body: JSON.stringify({ email, password, name: "Reconciliación E2E", autoConfirm: true }),
  });
  // Import dinámico: el SDK es solo ESM y el loader de Playwright resolvería el import estático con require.
  const { createClient } = await import("@insforge/sdk");
  const client = createClient({ baseUrl: env("NEXT_PUBLIC_INSFORGE_BASE_URL"), anonKey: env("NEXT_PUBLIC_INSFORGE_ANON_KEY") });
  const { data: session, error: sessionError } = await client.auth.signInWithPassword({ email, password });
  if (sessionError || !session?.user) throw new Error(`No se pudo iniciar sesión: ${sessionError?.message ?? "sin usuario"}`);
  userId = session.user.id;

  const [plan] = await adminRows("subscription_plans?code=eq.pro&is_active=eq.true&select=amount_cents&limit=1");
  const amount = Number(plan?.amount_cents) / 100;
  expect(amount).toBeGreaterThan(0);

  await admin("database/records/businesses", {
    method: "POST",
    body: JSON.stringify([{
      owner_id: userId,
      name: `Reconciliación ${runId}`,
      slug: `recon-${runId}`,
      subscription_provider: "mercadopago",
      subscription_status: "expired",
      subscription_plan: "pro",
      pending_subscription_plan: "pro",
      trial_ends_at: new Date(Date.now() - 2 * DAY).toISOString(),
    }]),
  });
  const [business] = await adminRows(`businesses?slug=eq.recon-${runId}&select=id`);
  businessId = business.id;

  nextPaymentDate = new Date(Date.now() + 29 * DAY).toISOString();
  preapprovalId = await createPreapproval(businessId, amount, { next_payment_date: nextPaymentDate });
  await fetch(`${MOCK_URL}/checkout/${preapprovalId}`);
  await admin(`database/records/businesses?id=eq.${businessId}`, {
    method: "PATCH",
    body: JSON.stringify({ subscription_external_id: preapprovalId, subscription_checkout_url: `${MOCK_URL}/checkout/${preapprovalId}` }),
  });

  // Un intento rechazado viejo y el reintento aprobado después: los webhooks de ambos se perdieron.
  await mock("/__test/authorized_payments", {
    method: "POST",
    body: JSON.stringify({ preapproval_id: preapprovalId, id: 9100, payment_id: `recon-${runId}-rejected`, payment_status: "rejected", date_created: new Date(Date.now() - 3 * DAY).toISOString() }),
  });
  await mock("/__test/authorized_payments", {
    method: "POST",
    body: JSON.stringify({ preapproval_id: preapprovalId, id: 9101, payment_id: `recon-${runId}-approved`, payment_status: "approved", date_created: new Date(Date.now() - DAY).toISOString() }),
  });
  // Una factura programada sin cobro no cambia nada.
  await mock("/__test/authorized_payments", {
    method: "POST",
    body: JSON.stringify({ preapproval_id: preapprovalId, id: 9102, status: "scheduled", date_created: new Date(Date.now() + 29 * DAY).toISOString() }),
  });

  // Huérfanas: el checkout se creó en Mercado Pago pero nunca quedó vinculado al negocio.
  staleOrphanId = await createPreapproval(businessId, amount, { date_created: new Date(Date.now() - 2 * DAY).toISOString() });
  freshOrphanId = await createPreapproval(businessId, amount);
  authorizedOrphanId = await createPreapproval(businessId, amount);
  await fetch(`${MOCK_URL}/checkout/${authorizedOrphanId}`);
});

test.afterAll(async () => {
  if (businessId) await admin(`database/records/businesses?id=eq.${businessId}`, { method: "DELETE" }).catch(() => undefined);
  if (userId) await admin("auth/users", { method: "DELETE", body: JSON.stringify({ userIds: [userId] }) }).catch(() => undefined);
});

async function runCron(request: import("@playwright/test").APIRequestContext) {
  const response = await request.get(`/api/cron/reconcile-subscriptions?businessId=${businessId}`, {
    headers: { Authorization: `Bearer ${CRON_SECRET}` },
  });
  expect(response.status()).toBe(200);
  return await response.json() as Report;
}

test("el cron exige CRON_SECRET", async ({ request }) => {
  expect((await request.get("/api/cron/reconcile-subscriptions")).status()).toBe(401);
  expect((await request.post("/api/cron/reconcile-subscriptions", { headers: { Authorization: "Bearer otro" } })).status()).toBe(401);
});

test("aplica el cobro aprobado perdido y no pasa a mora por un rechazo viejo", async ({ request }) => {
  const report = firstReport = await runCron(request);
  expect(report.errors).toEqual([]);
  expect(report).toMatchObject({ businesses: 1, synced: 1, paymentsApplied: 1 });

  const [business] = await adminRows(`businesses?id=eq.${businessId}&select=subscription_status,subscription_current_period_end,pending_subscription_plan,subscription_checkout_url,subscription_last_payment_id`);
  expect(business.subscription_status).toBe("active");
  expect(new Date(String(business.subscription_current_period_end)).toISOString()).toBe(nextPaymentDate);
  expect(business.pending_subscription_plan).toBeNull();
  expect(business.subscription_checkout_url).toBeNull();
  expect(business.subscription_last_payment_id).toBe(`recon-${runId}-approved`);

  const payments = await adminRows(`subscription_payments?business_id=eq.${businessId}&select=provider_payment_id,status`);
  expect(payments).toEqual([{ provider_payment_id: `recon-${runId}-approved`, status: "approved" }]);
});

test("cancela huérfanas pendientes viejas y reporta las autorizadas", async ({ request }) => {
  expect(firstReport.orphans.searchError).toBeNull();
  expect(firstReport.orphans.cancelled).toEqual([staleOrphanId]);
  expect(firstReport.orphans.reported.map((orphan) => orphan.id)).toEqual([authorizedOrphanId]);

  // La siguiente corrida ya no la ve abierta y sigue reportando la autorizada.
  const report = await runCron(request);
  expect(report.orphans.cancelled).toEqual([]);
  expect(report.orphans.reported.map((orphan) => orphan.id)).toEqual([authorizedOrphanId]);
  expect((await mock(`/preapproval/${staleOrphanId}`)).status).toBe("cancelled");
  expect((await mock(`/preapproval/${freshOrphanId}`)).status).toBe("pending");
  expect((await mock(`/preapproval/${authorizedOrphanId}`)).status).toBe("authorized");
  expect((await mock(`/preapproval/${preapprovalId}`)).status).toBe("authorized");
});

test("una segunda corrida no vuelve a aplicar nada", async ({ request }) => {
  const report = await runCron(request);
  expect(report).toMatchObject({ synced: 1, paymentsApplied: 0, errors: [] });
});

test("una preapproval pausada o cancelada no extiende el período sin pago", async ({ request }) => {
  const shortPeriodEnd = new Date(Date.now() + 2 * DAY).toISOString();
  await admin(`database/records/businesses?id=eq.${businessId}`, { method: "PATCH", body: JSON.stringify({ subscription_current_period_end: shortPeriodEnd }) });

  const farFuture = new Date(Date.now() + 365 * DAY).toISOString();
  await admin("database/rpc/sync_business_subscription_status", {
    method: "POST",
    body: JSON.stringify({ p_external_id: preapprovalId, p_status: "paused", p_current_period_end: farFuture }),
  });
  let [business] = await adminRows(`businesses?id=eq.${businessId}&select=subscription_current_period_end`);
  expect(new Date(String(business.subscription_current_period_end)).toISOString()).toBe(shortPeriodEnd);

  // Cancelada en Mercado Pago con próxima fecha futura: conserva el período pago y lo marca para terminar.
  await mock(`/preapproval/${preapprovalId}`, { method: "PUT", body: JSON.stringify({ status: "cancelled", next_payment_date: farFuture }) });
  const report = await runCron(request);
  expect(report.errors).toEqual([]);
  [business] = await adminRows(`businesses?id=eq.${businessId}&select=subscription_status,subscription_current_period_end,subscription_cancel_at_period_end`);
  expect(new Date(String(business.subscription_current_period_end)).toISOString()).toBe(shortPeriodEnd);
  expect(business.subscription_cancel_at_period_end).toBe(true);
  expect(business.subscription_status).toBe("active");
});

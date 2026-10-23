import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// InsForge y Mercado Pago se reemplazan por dobles: cada tabla devuelve el resultado configurado y se
// registran inserts, updates y deletes.
const getCurrentUser = vi.fn();
vi.mock("@/lib/insforge-server", () => ({
  getRequestAccessToken: (request: Request) => request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null,
  createInsforgeTokenClient: () => ({ auth: { getCurrentUser } }),
}));

type Result = { data: unknown; error: { message: string } | null };
const results: Record<string, Result> = {};
const writes: Array<{ table: string; op: string; values?: unknown }> = [];
vi.mock("@/lib/insforge-admin", () => {
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "limit"]) chain[method] = () => chain;
    for (const op of ["insert", "update", "delete"]) {
      chain[op] = (values?: unknown) => {
        writes.push({ table, op, values });
        return chain;
      };
    }
    chain.then = (resolve: (value: Result) => void) => resolve(results[table] ?? { data: null, error: null });
    return chain;
  };
  return { insforgeAdmin: { database: { from } } };
});

const createMercadoPagoPreference = vi.fn();
vi.mock("@/lib/mercadopago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mercadopago")>()),
  createMercadoPagoPreference,
}));

const BUSINESS = "8e208072-3fbe-431f-be0b-5a2b5ceae506";
const USER = { id: "a774e067-98b8-44c1-a79e-448fc5c3c2d6", email: "owner@test.com" };
const OPTIONS = [{ code: "small", label: "Chico", amount_cents: 500_000, currency: "ARS", sort_order: 1 }];

async function post(body: unknown, headers: Record<string, string> = { authorization: "Bearer token" }) {
  const { POST } = await import("@/app/api/contributions/checkout/route");
  const request = new NextRequest("https://www.citadely.com.ar/api/contributions/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const response = await POST(request);
  return { status: response.status, json: await response.json() };
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("APP_BASE_URL", "https://www.citadely.com.ar");
  getCurrentUser.mockReset().mockResolvedValue({ data: { user: USER }, error: null });
  createMercadoPagoPreference.mockReset().mockResolvedValue({ id: "pref-1", init_point: "https://mp.test/checkout/pref-1" });
  writes.length = 0;
  for (const key of Object.keys(results)) delete results[key];
  results.businesses = { data: [{ id: BUSINESS, owner_id: USER.id, is_demo: false }], error: null };
  results.contribution_options = { data: OPTIONS, error: null };
  results.contributions = { data: null, error: null };
});

describe("POST /api/contributions/checkout", () => {
  it("exige sesión y un negocio propio", async () => {
    expect((await post({ businessId: BUSINESS, optionCode: "small" }, {})).status).toBe(401);
    expect((await post("{no es json")).status).toBe(400);
    expect((await post({ businessId: "no-uuid", optionCode: "small" })).status).toBe(400);
    results.businesses = { data: [], error: null };
    expect((await post({ businessId: BUSINESS, optionCode: "small" })).status).toBe(404);
    expect(writes).toEqual([]);
    expect(createMercadoPagoPreference).not.toHaveBeenCalled();
  });

  it("rechaza importes inválidos sin crear el aporte", async () => {
    const result = await post({ businessId: BUSINESS, amountCents: 5_000 });
    expect(result.status).toBe(400);
    expect(result.json.error).toMatch(/\$1\.000 y \$500\.000/);
    expect((await post({ businessId: BUSINESS, optionCode: "inexistente" })).status).toBe(400);
    expect(writes).toEqual([]);
  });

  it("crea el aporte pendiente y la preferencia de Checkout Pro", async () => {
    const result = await post({ businessId: BUSINESS, optionCode: "small" });
    expect(result.status).toBe(200);
    expect(result.json.checkoutUrl).toBe("https://mp.test/checkout/pref-1");
    const contributionId = result.json.contributionId as string;

    const insert = writes.find((write) => write.op === "insert");
    expect(insert?.table).toBe("contributions");
    expect(insert?.values).toEqual([expect.objectContaining({
      id: contributionId,
      external_reference: contributionId,
      business_id: BUSINESS,
      user_id: USER.id,
      amount_cents: 500_000,
      currency: "ARS",
      status: "pending",
      option_code: "small",
      payer_email: USER.email,
    })]);

    const preference = createMercadoPagoPreference.mock.calls[0][0];
    expect(preference).toMatchObject({
      external_reference: contributionId,
      items: [{ id: contributionId, title: "Aporte a Citadely", quantity: 1, unit_price: 5_000, currency_id: "ARS" }],
      payer: { email: USER.email },
      auto_return: "approved",
      binary_mode: true,
      statement_descriptor: "CITADELY",
      back_urls: { success: "https://www.citadely.com.ar/negocio/configuracion?aporte=aprobado" },
      notification_url: "https://www.citadely.com.ar/api/mercadopago/webhook",
    });
    expect(writes.find((write) => write.op === "update")?.values).toMatchObject({ provider_preference_id: "pref-1" });
  });

  it("acepta un importe libre y sin origen público no pide auto_return", async () => {
    vi.stubEnv("APP_BASE_URL", "http://127.0.0.1:3002");
    const result = await post({ businessId: BUSINESS, amountCents: 250_000 });
    expect(result.status).toBe(200);
    expect(writes[0].values).toEqual([expect.objectContaining({ amount_cents: 250_000, option_code: null })]);
    expect(createMercadoPagoPreference.mock.calls[0][0]).not.toHaveProperty("auto_return");
  });

  it("si Mercado Pago falla responde 502 y borra el aporte pendiente", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    createMercadoPagoPreference.mockRejectedValueOnce(new Error("Mercado Pago: invalid token"));
    const result = await post({ businessId: BUSINESS, optionCode: "small" });
    expect(result.status).toBe(502);
    expect(JSON.stringify(result.json)).not.toContain("invalid token");
    expect(writes.map((write) => write.op)).toEqual(["insert", "delete"]);
  });

  it("en producción la cuenta demo no puede aportar", async () => {
    vi.resetModules();
    vi.stubEnv("VERCEL_ENV", "production");
    results.businesses = { data: [{ id: BUSINESS, owner_id: USER.id, is_demo: true }], error: null };
    expect((await post({ businessId: BUSINESS, optionCode: "small" })).status).toBe(403);
    expect(writes).toEqual([]);
    vi.resetModules();
  });
});

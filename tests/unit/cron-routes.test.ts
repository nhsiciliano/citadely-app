import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const limit = vi.fn();
vi.mock("@/lib/insforge-admin", () => {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte"]) chain[method] = () => chain;
  chain.limit = limit;
  return { insforgeAdmin: { database: { from: () => chain, rpc } } };
});

beforeEach(() => {
  rpc.mockReset();
  limit.mockReset();
  vi.stubEnv("CRON_SECRET", "s3cret");
});
afterEach(() => vi.unstubAllEnvs());

const call = (handler: (request: never) => Promise<Response>, authorization?: string) =>
  handler(new Request("https://x.test/api/cron", { headers: authorization ? { authorization } : {} }) as never);

describe("cron routes", () => {
  it("cancel-expired-deposits exige el secreto y expone GET y POST", async () => {
    const route = await import("@/app/api/cron/cancel-expired-deposits/route");
    expect(route.GET).toBe(route.POST);
    expect((await call(route.GET)).status).toBe(401);
    expect((await call(route.GET, "Bearer otro")).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();

    rpc.mockResolvedValueOnce({ data: 3, error: null });
    const ok = await call(route.GET, "Bearer s3cret");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ cancelled: 3 });
  });

  it("failure-alerts cuenta filas failed y no se ejecuta sin secreto", async () => {
    const route = await import("@/app/api/cron/failure-alerts/route");
    expect((await call(route.GET)).status).toBe(401);

    limit.mockResolvedValueOnce({ data: [{ id: 1 }, { id: 2 }], error: null }).mockResolvedValueOnce({ data: [], error: null });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await call(route.GET, "Bearer s3cret");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ failures: { email_outbox: 2, mercadopago_webhook_events: 0 } });
  });

  it("transactional-email rechaza sin secreto antes de tocar la base", async () => {
    const route = await import("@/app/api/cron/transactional-email/route");
    expect((await call(route.POST)).status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });
});

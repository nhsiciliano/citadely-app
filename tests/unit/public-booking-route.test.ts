import { beforeEach, describe, expect, it, vi } from "vitest";

// InsForge se reemplaza por un doble que registra las llamadas a rpc y devuelve filas fijas.
const rpc = vi.fn();
const maybeSingle = vi.fn();
vi.mock("@/lib/insforge-admin", () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.maybeSingle = maybeSingle;
  return { insforgeAdmin: { database: { from: () => chain, rpc } } };
});

const BUSINESS = "8e208072-3fbe-431f-be0b-5a2b5ceae506";
const SERVICE = "4814346d-8810-4559-8b9c-2c6673c03f36";
const startsAt = new Date(Date.now() + 86_400_000).toISOString();

const valid = {
  businessId: BUSINESS,
  serviceId: SERVICE,
  startsAt,
  clientName: "Ana Pérez",
  clientEmail: "Ana@Example.com",
  clientPhone: "11 2345 6789",
  clientMessage: "",
};

async function post(body: unknown, headers: Record<string, string> = {}) {
  const { POST } = await import("@/app/api/public-booking/route");
  const request = new Request("https://x.test/api/public-booking", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  const response = await POST(request);
  return { status: response.status, headers: response.headers, json: await response.json() };
}

beforeEach(() => {
  rpc.mockReset();
  maybeSingle.mockReset().mockResolvedValue({ data: { id: BUSINESS }, error: null });
});

describe("POST /api/public-booking", () => {
  it("rechaza cuerpos inválidos, demasiado grandes y datos mal formados", async () => {
    expect((await post("{no es json")).status).toBe(400);
    expect((await post("x".repeat(9000))).status).toBe(400);
    expect((await post({ ...valid, businessId: "no-uuid" })).status).toBe(400);
    expect((await post({ ...valid, clientEmail: "sin-arroba" })).status).toBe(400);
    expect((await post({ ...valid, clientPhone: "123" })).status).toBe(400);
    expect((await post({ ...valid, clientName: "x".repeat(121) })).status).toBe(400);
    expect((await post({ ...valid, clientMessage: "x".repeat(2001) })).status).toBe(400);
    expect((await post({ ...valid, startsAt: "ayer" })).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("responde 429 con Retry-After cuando el limitador rechaza", async () => {
    rpc.mockResolvedValueOnce({ data: "email", error: null });
    const result = await post(valid, { "x-forwarded-for": "9.9.9.9" });
    expect(result.status).toBe(429);
    expect(result.headers.get("retry-after")).toBe("600");
    expect(result.json.error).toMatch(/demasiados intentos/i);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("register_public_booking_attempt");
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_email: "ana@example.com" });
    expect(rpc.mock.calls[0][1].p_ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("falla cerrado (503) si el limitador no responde", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { message: "function does not exist" } });
    const result = await post(valid);
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.json)).not.toContain("function does not exist");
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("crea la reserva y devuelve los datos de seña", async () => {
    rpc
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: [{ appointment_id: "a1", client_id: "c1", status: "pending_payment", amount_cents: 1000, deposit_expires_at: "2026-10-16T10:00:00Z" }], error: null });
    const result = await post(valid);
    expect(result.status).toBe(200);
    expect(result.json).toMatchObject({ appointment_id: "a1", status: "pending_payment", amount_cents: 1000 });
    expect(rpc.mock.calls[1][0]).toBe("create_public_booking");
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_business_id: BUSINESS, p_service_id: BUSINESS, p_client_email: "ana@example.com" });
  });

  it("traduce errores conocidos a 409 y oculta los desconocidos", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: "El horario ya no tiene cupos disponibles" } });
    const known = await post(valid);
    expect(known.status).toBe(409);
    expect(known.json.error).toBe("El horario ya no tiene cupos disponibles");

    rpc.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: { message: 'relation "x" does not exist' } });
    const unknown = await post(valid);
    expect(unknown.status).toBe(500);
    expect(JSON.stringify(unknown.json)).not.toContain("relation");
  });
});

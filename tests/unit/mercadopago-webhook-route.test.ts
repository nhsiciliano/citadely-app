import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const limit = vi.fn();
vi.mock("@/lib/insforge-admin", () => {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.limit = limit;
  return { insforgeAdmin: { database: { from: () => chain, rpc } } };
});

const getMercadoPagoPayment = vi.fn();
vi.mock("@/lib/mercadopago", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/mercadopago")>()),
  getMercadoPagoPayment,
}));

const SECRET = "unit-webhook-secret";
const CONTRIBUTION = "e77ba604-8398-4e06-9451-c961ce0e1632";

function signature(dataId: string, requestId: string, secret = SECRET) {
  const ts = String(Math.floor(Date.now() / 1000));
  const hash = crypto.createHmac("sha256", secret).update(`id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest("hex");
  return `ts=${ts},v1=${hash}`;
}

async function post(body: Record<string, unknown>, { secret = SECRET }: { secret?: string } = {}) {
  const { POST } = await import("@/app/api/mercadopago/webhook/route");
  const dataId = String((body.data as { id?: unknown } | undefined)?.id ?? "");
  const requestId = crypto.randomUUID();
  const request = new NextRequest(`https://www.citadely.com.ar/api/mercadopago/webhook?data.id=${dataId}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": requestId, "x-signature": signature(dataId, requestId, secret) },
    body: JSON.stringify(body),
  });
  const response = await POST(request);
  return { status: response.status, json: await response.json() };
}

const rpcCalls = (name: string) => rpc.mock.calls.filter(([fn]) => fn === name);

beforeEach(() => {
  vi.stubEnv("MERCADOPAGO_WEBHOOK_SECRET", SECRET);
  rpc.mockReset().mockImplementation(async (fn: string) => {
    if (fn === "claim_mercadopago_webhook_event") return { data: [{ event_id: "event-1", claim_state: "claimed" }], error: null };
    if (fn === "apply_contribution_payment") return { data: "applied", error: null };
    return { data: null, error: null };
  });
  limit.mockReset().mockResolvedValue({ data: [{ id: CONTRIBUTION }], error: null });
  getMercadoPagoPayment.mockReset().mockResolvedValue({
    id: 9729081353,
    status: "approved",
    external_reference: CONTRIBUTION,
    transaction_amount: 5000,
    currency_id: "ARS",
    payer: { email: "payer@test.com" },
    date_approved: "2026-10-23T16:28:28.135Z",
  });
});

describe("POST /api/mercadopago/webhook", () => {
  it("rechaza firmas inválidas sin registrar el evento", async () => {
    const result = await post({ type: "payment", data: { id: "9729081353" } }, { secret: "otro" });
    expect(result.status).toBe(401);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("aplica un pago aprobado al aporte con importe en centavos", async () => {
    const result = await post({ type: "payment", action: "payment.created", data: { id: "9729081353" } });
    expect(result).toEqual({ status: 200, json: { received: true, result: "applied" } });
    expect(rpcCalls("apply_contribution_payment")[0][1]).toEqual({
      p_contribution_id: CONTRIBUTION,
      p_provider_payment_id: "9729081353",
      p_status: "approved",
      p_amount_cents: 500_000,
      p_currency: "ARS",
      p_payer_email: "payer@test.com",
      p_approved_at: "2026-10-23T16:28:28.135Z",
    });
    expect(rpcCalls("finish_mercadopago_webhook_event")[0][1]).toMatchObject({ p_event_id: "event-1", p_status: "processed" });
  });

  it("un evento ya reclamado no se vuelve a procesar", async () => {
    rpc.mockImplementationOnce(async () => ({ data: [{ event_id: "event-1", claim_state: "completed" }], error: null }));
    const result = await post({ type: "payment", data: { id: "9729081353" } });
    expect(result.json).toEqual({ received: true, duplicate: true });
    expect(getMercadoPagoPayment).not.toHaveBeenCalled();
  });

  it("ignora tipos que no son payment, como subscription_preapproval", async () => {
    const result = await post({ type: "subscription_preapproval", data: { id: "pre-123" } });
    expect(result.json).toEqual({ received: true, ignored: "subscription_preapproval" });
    expect(getMercadoPagoPayment).not.toHaveBeenCalled();
    expect(rpcCalls("finish_mercadopago_webhook_event")[0][1]).toMatchObject({ p_status: "ignored" });
  });

  it("ignora con 200 los pagos que no son de un aporte", async () => {
    getMercadoPagoPayment.mockResolvedValueOnce({ id: 1, status: "approved", transaction_amount: 10, currency_id: "ARS" });
    expect((await post({ type: "payment", data: { id: "1" } })).json).toEqual({ received: true, ignored: "missing_external_reference" });

    vi.spyOn(console, "warn").mockImplementation(() => {});
    limit.mockResolvedValueOnce({ data: [], error: null });
    const unknown = await post({ type: "payment", data: { id: "9729081353" } });
    expect(unknown).toEqual({ status: 200, json: { received: true, ignored: "unknown_contribution" } });
    expect(rpcCalls("apply_contribution_payment")).toHaveLength(0);
  });

  it("ignored_other_payment se registra como ignored", async () => {
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "claim_mercadopago_webhook_event") return { data: [{ event_id: "event-1", claim_state: "claimed" }], error: null };
      if (fn === "apply_contribution_payment") return { data: "ignored_other_payment", error: null };
      return { data: null, error: null };
    });
    const result = await post({ type: "payment", data: { id: "9729081353" } });
    expect(result.json).toEqual({ received: true, result: "ignored_other_payment" });
    expect(rpcCalls("finish_mercadopago_webhook_event")[0][1]).toMatchObject({ p_status: "ignored" });
  });

  it("un estado que la base rechaza deja el evento en failed", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "claim_mercadopago_webhook_event") return { data: [{ event_id: "event-1", claim_state: "claimed" }], error: null };
      if (fn === "apply_contribution_payment") return { data: null, error: { message: "Estado de pago invalido: in_mediation" } };
      return { data: null, error: null };
    });
    const result = await post({ type: "payment", data: { id: "9729081353" } });
    expect(result.status).toBe(500);
    expect(rpcCalls("finish_mercadopago_webhook_event")[0][1]).toEqual({
      p_event_id: "event-1",
      p_status: "failed",
      p_error_message: "Estado de pago invalido: in_mediation",
    });
  });

  it("responde al simulador de Mercado Pago sin tocar la base", async () => {
    const result = await post({ type: "payment", id: "123456", date: "2021-11-01T02:02:02Z", data: { id: "123456" } });
    expect(result.json).toEqual({ received: true, simulated: true });
    expect(rpc).not.toHaveBeenCalled();
  });
});

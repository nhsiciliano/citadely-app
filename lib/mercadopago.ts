import crypto from "node:crypto";
import { assertProductionEnv } from "@/lib/env";

export type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export type MercadoPagoPaymentResponse = {
  id: number;
  status: string;
  external_reference?: string;
  preapproval_id?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string;
};

export type MercadoPagoAuthorizedPaymentResponse = {
  id: number;
  status: string;
  payment?: {
    id?: number;
    status?: string;
    status_detail?: string;
  };
  external_reference?: string;
  preapproval_id?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_created?: string;
  date_approved?: string;
};

export type MercadoPagoPreapprovalResponse = {
  id: string;
  status: string;
  init_point?: string;
  reason?: string;
  external_reference?: string;
  next_payment_date?: string;
  payer_email?: string;
  auto_recurring?: {
    frequency?: number;
    frequency_type?: string;
    start_date?: string;
    transaction_amount?: number;
    currency_id?: string;
  };
};

const MERCADOPAGO_API = process.env.MERCADOPAGO_API_BASE_URL ?? "https://api.mercadopago.com";
const MERCADOPAGO_REQUEST_TIMEOUT_MS = 8_000;

type MercadoPagoError = {
  message?: string;
  error?: string;
};

export function getMercadoPagoAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN en el entorno.");
  assertProductionEnv();
  return token;
}

async function mercadoPagoRequest<T>(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${getMercadoPagoAccessToken()}`);
  if (init.body) headers.set("Content-Type", "application/json");

  const response = await fetch(`${MERCADOPAGO_API}${path}`, {
    ...init,
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(MERCADOPAGO_REQUEST_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => ({}))) as T & MercadoPagoError;
  if (!response.ok) {
    const providerMessage = data.message ?? data.error;
    throw new Error(providerMessage ? `Mercado Pago: ${providerMessage}` : `Mercado Pago respondio ${response.status}.`);
  }

  return data;
}

export async function createMercadoPagoPreference(body: Record<string, unknown>) {
  return mercadoPagoRequest<MercadoPagoPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMercadoPagoPayment(paymentId: string) {
  return mercadoPagoRequest<MercadoPagoPaymentResponse>(`/v1/payments/${encodeURIComponent(paymentId)}`);
}

export async function createMercadoPagoPreapproval(body: Record<string, unknown>) {
  return mercadoPagoRequest<MercadoPagoPreapprovalResponse>("/preapproval", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getMercadoPagoPreapproval(preapprovalId: string) {
  return mercadoPagoRequest<MercadoPagoPreapprovalResponse>(`/preapproval/${encodeURIComponent(preapprovalId)}`);
}

export async function updateMercadoPagoPreapproval(preapprovalId: string, body: Record<string, unknown>) {
  return mercadoPagoRequest<MercadoPagoPreapprovalResponse>(`/preapproval/${encodeURIComponent(preapprovalId)}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function getMercadoPagoAuthorizedPayment(authorizedPaymentId: string) {
  return mercadoPagoRequest<MercadoPagoAuthorizedPaymentResponse>(`/authorized_payments/${encodeURIComponent(authorizedPaymentId)}`);
}

export function verifyMercadoPagoSignature({
  dataId,
  requestId,
  signature,
}: {
  dataId: string | null;
  requestId: string | null;
  signature: string | null;
}) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!dataId || !requestId || !signature) return false;

  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=", 2);
      return [key?.trim(), value?.trim()];
    }),
  );

  const timestamp = parts.ts;
  const hash = parts.v1;
  if (!timestamp || !hash || !/^[a-f0-9]{64}$/i.test(hash)) return false;

  const manifestParts = [];
  if (dataId) manifestParts.push(`id:${dataId.toLowerCase()}`);
  if (requestId) manifestParts.push(`request-id:${requestId}`);
  manifestParts.push(`ts:${timestamp}`);

  const manifest = `${manifestParts.join(";")};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  if (expected.length !== hash.length) return false;

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
}

export function buildMercadoPagoEventKey({
  notificationId,
  type,
  action,
  dataId,
  requestId,
}: {
  notificationId?: string;
  type?: string;
  action?: string;
  dataId: string;
  requestId?: string | null;
}) {
  return crypto
    .createHash("sha256")
    .update([notificationId, type, action, dataId.toLowerCase(), requestId].map((value) => value ?? "").join("|"))
    .digest("hex");
}

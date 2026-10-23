import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { assertProductionEnv, getProtectionBypassSecret } from "@/lib/env";

export type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export type MercadoPagoPaymentResponse = {
  id: number;
  status: string;
  status_detail?: string;
  external_reference?: string;
  transaction_amount?: number;
  currency_id?: string;
  date_approved?: string;
  payer?: { email?: string };
  metadata?: Record<string, unknown>;
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

/** Origen público de la app para back_urls y notification_url (APP_BASE_URL, si no el host de la request). */
export function getAppBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;
  if (configuredUrl) {
    const url = new URL(configuredUrl);
    if (url.hostname === "citadely.com.ar") url.hostname = "www.citadely.com.ar";
    return url.origin;
  }

  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin;
}

/** URL del webhook; en Preview lleva el bypass de Deployment Protection. */
export function getWebhookUrl(origin: string) {
  const webhookUrl = new URL("/api/mercadopago/webhook", origin);
  const protectionBypass = getProtectionBypassSecret();
  if (protectionBypass) webhookUrl.searchParams.set("x-vercel-protection-bypass", protectionBypass);
  return webhookUrl.toString();
}

// Ventana para aceptar una firma. El webhook es idempotente (claim por evento y re-fetch del recurso
// en Mercado Pago), así que un replay no causa daño. Rechazar un reintento legítimo sí: el aporte queda
// pendiente para siempre. Por eso la ventana es amplia.
const MERCADOPAGO_SIGNATURE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// ts llega como Unix en segundos (lo que usa el E2E) o en milisegundos; se normaliza antes de comparar.
function isFreshSignatureTimestamp(timestamp: string, now = Date.now()) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return false;
  const signedAtMs = value < 1e12 ? value * 1000 : value;
  return Math.abs(now - signedAtMs) <= MERCADOPAGO_SIGNATURE_MAX_AGE_MS;
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
  if (!isFreshSignatureTimestamp(timestamp)) return false;

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

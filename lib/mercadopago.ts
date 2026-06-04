import crypto from "node:crypto";

export type MercadoPagoPreferenceResponse = {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
};

export type MercadoPagoPaymentResponse = {
  id: number;
  status: string;
  external_reference?: string;
};

export type MercadoPagoPreapprovalResponse = {
  id: string;
  status: string;
  init_point?: string;
  reason?: string;
  external_reference?: string;
  next_payment_date?: string;
};

const MERCADOPAGO_API = "https://api.mercadopago.com";

export function getMercadoPagoAccessToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) throw new Error("Falta MERCADOPAGO_ACCESS_TOKEN en el entorno.");
  return token;
}

export async function createMercadoPagoPreference(body: Record<string, unknown>) {
  const response = await fetch(`${MERCADOPAGO_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as MercadoPagoPreferenceResponse & {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Mercado Pago rechazo la preferencia.");
  }

  return data;
}

export async function getMercadoPagoPayment(paymentId: string) {
  const response = await fetch(`${MERCADOPAGO_API}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
    },
  });

  const data = (await response.json()) as MercadoPagoPaymentResponse & {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "No se pudo leer el pago de Mercado Pago.");
  }

  return data;
}

export async function createMercadoPagoPreapproval(body: Record<string, unknown>) {
  const response = await fetch(`${MERCADOPAGO_API}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as MercadoPagoPreapprovalResponse & {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "Mercado Pago rechazo la suscripcion.");
  }

  return data;
}

export async function getMercadoPagoPreapproval(preapprovalId: string) {
  const response = await fetch(`${MERCADOPAGO_API}/preapproval/${preapprovalId}`, {
    headers: {
      Authorization: `Bearer ${getMercadoPagoAccessToken()}`,
    },
  });

  const data = (await response.json()) as MercadoPagoPreapprovalResponse & {
    message?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.message ?? data.error ?? "No se pudo leer la suscripcion de Mercado Pago.");
  }

  return data;
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
  if (!secret) return true;
  if (!dataId || !requestId || !signature) return false;

  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, value] = part.split("=");
      return [key?.trim(), value?.trim()];
    }),
  );

  const timestamp = parts.ts;
  const hash = parts.v1;
  if (!timestamp || !hash) return false;

  const manifest = `id:${dataId};request-id:${requestId};ts:${timestamp};`;
  const expected = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(hash));
}

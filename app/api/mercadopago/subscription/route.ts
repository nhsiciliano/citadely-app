import { NextRequest } from "next/server";
import { createMercadoPagoPreapproval } from "@/lib/mercadopago";

const MONTHLY_PRICE_ARS = 15000;

function getAppBaseUrl(request: NextRequest) {
  const configuredUrl = process.env.APP_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  const forwardedHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return request.nextUrl.origin;
}

export async function POST(request: NextRequest) {
  try {
    const { businessId, payerEmail } = (await request.json()) as {
      businessId?: string;
      payerEmail?: string;
    };

    if (!businessId) {
      return Response.json({ error: "businessId es requerido." }, { status: 400 });
    }

    const origin = getAppBaseUrl(request);
    const mercadoPagoPayerEmail = process.env.MERCADOPAGO_PAYER_EMAIL ?? payerEmail;

    if (!mercadoPagoPayerEmail) {
      return Response.json({ error: "payerEmail es requerido." }, { status: 400 });
    }

    const preapproval = await createMercadoPagoPreapproval({
      reason: "Citadely - Plan mensual",
      external_reference: businessId,
      payer_email: mercadoPagoPayerEmail,
      back_url: `${origin}/negocio`,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: MONTHLY_PRICE_ARS,
        currency_id: "ARS",
      },
    });

    if (!preapproval.id || !preapproval.init_point) {
      return Response.json({ error: "Mercado Pago no devolvio URL de suscripcion." }, { status: 502 });
    }

    return Response.json({
      externalId: preapproval.id,
      checkoutUrl: preapproval.init_point,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear la suscripcion.";
    return Response.json({ error: message }, { status: 500 });
  }
}

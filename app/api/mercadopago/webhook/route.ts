import { NextRequest } from "next/server";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { buildMercadoPagoEventKey, getMercadoPagoPayment, verifyMercadoPagoSignature } from "@/lib/mercadopago";

type MercadoPagoWebhookBody = {
  type?: string;
  action?: string;
  date?: string;
  id?: string | number;
  data?: { id?: string | number };
};

type WebhookClaim = {
  event_id: string | null;
  claim_state: "claimed" | "completed" | "processing";
};

type ContributionPaymentResult = "applied" | "duplicate" | "ignored_other_payment";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function claimWebhook(body: MercadoPagoWebhookBody, dataId: string, requestId: string | null) {
  if (!insforgeAdmin) throw new Error("InsForge admin no esta configurado.");
  const eventKey = buildMercadoPagoEventKey({
    notificationId: body.id == null ? undefined : String(body.id),
    type: body.type,
    action: body.action,
    dataId,
    requestId,
  });
  const { data, error } = await insforgeAdmin.database.rpc("claim_mercadopago_webhook_event", {
    p_event_key: eventKey,
    p_event_type: body.type ?? null,
    p_action: body.action ?? null,
    p_resource_id: dataId,
    p_request_id: requestId,
  });
  if (error) throw new Error(error.message);
  return ((data as WebhookClaim[] | null)?.[0] ?? null);
}

async function finishWebhook(eventId: string, status: "processed" | "failed" | "ignored", errorMessage?: string) {
  if (!insforgeAdmin) return;
  const { error } = await insforgeAdmin.database.rpc("finish_mercadopago_webhook_event", {
    p_event_id: eventId,
    p_status: status,
    p_error_message: errorMessage ?? null,
  });
  if (error) console.error("mercadopago webhook finalization failed", { eventId, message: error.message });
}

async function contributionExists(contributionId: string) {
  if (!insforgeAdmin) throw new Error("InsForge admin no esta configurado.");
  const { data, error } = await insforgeAdmin.database.from("contributions").select("id").eq("id", contributionId).limit(1);
  if (error) throw new Error(error.message);
  return Boolean(data?.[0]);
}

export async function POST(request: NextRequest) {
  let eventId: string | null = null;
  try {
    if (!insforgeAdmin) return Response.json({ error: "InsForge admin no esta configurado." }, { status: 500 });

    const body = (await request.json()) as MercadoPagoWebhookBody;
    const queryDataId = request.nextUrl.searchParams.get("data.id");
    const rawDataId = queryDataId ?? body.data?.id;
    const dataId = rawDataId == null ? null : String(rawDataId);
    const requestId = request.headers.get("x-request-id");

    if (!verifyMercadoPagoSignature({
      dataId,
      requestId,
      signature: request.headers.get("x-signature"),
    })) {
      return Response.json({ error: "Firma invalida." }, { status: 401 });
    }

    if (!dataId) return Response.json({ received: true });
    if (String(body.id) === "123456" && String(body.data?.id) === "123456" && body.date === "2021-11-01T02:02:02Z") {
      return Response.json({ received: true, simulated: true });
    }

    const claim = await claimWebhook(body, dataId, requestId);
    if (!claim) throw new Error("No se pudo registrar el webhook.");
    if (claim.claim_state !== "claimed") return Response.json({ received: true, duplicate: true });
    eventId = claim.event_id;
    if (!eventId) throw new Error("El webhook no tiene identificador interno.");

    // Solo los pagos de Checkout Pro mueven aportes. Incluye los subscription_preapproval que
    // Mercado Pago sigue enviando al cancelar las suscripciones anteriores.
    if (body.type && body.type !== "payment") {
      await finishWebhook(eventId, "ignored");
      return Response.json({ received: true, ignored: body.type });
    }

    const payment = await getMercadoPagoPayment(dataId);
    // Pagos ajenos a los aportes (sin referencia o con una que no es un aporte): se registran como
    // ignorados y se responde 200, para que Mercado Pago no reintente indefinidamente.
    const contributionId = payment.external_reference;
    if (!contributionId || !UUID_PATTERN.test(contributionId)) {
      await finishWebhook(eventId, "ignored");
      return Response.json({ received: true, ignored: "missing_external_reference" });
    }
    if (!(await contributionExists(contributionId))) {
      console.warn("mercadopago payment for unknown contribution", { eventId, externalReference: contributionId });
      await finishWebhook(eventId, "ignored");
      return Response.json({ received: true, ignored: "unknown_contribution" });
    }

    if (!Number.isFinite(payment.transaction_amount) || !payment.currency_id) {
      throw new Error("El pago no informa importe y moneda validos.");
    }

    const { data, error } = await insforgeAdmin.database.rpc("apply_contribution_payment", {
      p_contribution_id: contributionId,
      p_provider_payment_id: String(payment.id),
      p_status: payment.status,
      p_amount_cents: Math.round(Number(payment.transaction_amount) * 100),
      p_currency: payment.currency_id,
      p_payer_email: payment.payer?.email ?? null,
      p_approved_at: payment.date_approved ?? null,
    });
    if (error) throw new Error(error.message);
    const result = data as ContributionPaymentResult;

    await finishWebhook(eventId, result === "ignored_other_payment" ? "ignored" : "processed");
    return Response.json({ received: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar el webhook.";
    if (eventId) await finishWebhook(eventId, "failed", message);
    console.error("mercadopago webhook failed", { eventId, message });
    return Response.json({ error: "No se pudo procesar el webhook." }, { status: 500 });
  }
}

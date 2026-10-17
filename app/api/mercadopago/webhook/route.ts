import { NextRequest } from "next/server";
import { insforgeAdmin } from "@/lib/insforge-admin";
import {
  buildMercadoPagoEventKey,
  getMercadoPagoAuthorizedPayment,
  getMercadoPagoPayment,
  getMercadoPagoPreapproval,
  verifyMercadoPagoSignature,
  type MercadoPagoPreapprovalResponse,
} from "@/lib/mercadopago";

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

type SubscriptionBusiness = {
  id: string;
  subscription_external_id: string | null;
};

async function claimWebhook(body: MercadoPagoWebhookBody, dataId: string, requestId: string | null) {
  if (!insforgeAdmin) throw new Error("InsForge admin no esta configurado.");
  const eventKey = buildMercadoPagoEventKey({
    notificationId: body.id == null ? undefined : String(body.id),
    type: body.type,
    action: body.action,
    dataId,
    requestId,
  });
  const { data, error } = await insforgeAdmin.database.rpc("claim_subscription_webhook_event", {
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
  const { error } = await insforgeAdmin.database.rpc("finish_subscription_webhook_event", {
    p_event_id: eventId,
    p_status: status,
    p_error_message: errorMessage ?? null,
  });
  if (error) console.error("subscription webhook finalization failed", { eventId, message: error.message });
}

async function getBusinessForPreapproval(
  preapproval: MercadoPagoPreapprovalResponse,
  providerPaymentId?: string,
) {
  if (!insforgeAdmin) throw new Error("InsForge admin no esta configurado.");
  let query = insforgeAdmin.database
    .from("businesses")
    .select("id,subscription_external_id");
  query = preapproval.external_reference
    ? query.eq("id", preapproval.external_reference)
    : query.eq("subscription_external_id", preapproval.id);
  const { data, error } = await query.limit(1);
  const business = (data?.[0] ?? null) as SubscriptionBusiness | null;
  if (error || !business) throw new Error("La suscripcion notificada no pertenece a un negocio.");
  if (preapproval.external_reference && preapproval.external_reference !== business.id) {
    throw new Error("La referencia externa de la suscripcion no coincide.");
  }
  const isCurrent = business.subscription_external_id === preapproval.id;
  if (!isCurrent && providerPaymentId) {
    const { data: paymentRows, error: paymentError } = await insforgeAdmin.database
      .from("subscription_payments")
      .select("id")
      .eq("business_id", business.id)
      .eq("provider_payment_id", providerPaymentId)
      .eq("subscription_external_id", preapproval.id)
      .limit(1);
    if (paymentError || !paymentRows?.[0]) throw new Error("El pago no pertenece a la suscripcion vigente ni a su historial.");
  }
  return { business, isCurrent };
}

async function applySubscriptionPayment({
  business,
  preapproval,
  providerPaymentId,
  status,
  amount,
  currency,
  paidAt,
  isCurrent,
}: {
  business: SubscriptionBusiness;
  preapproval: MercadoPagoPreapprovalResponse;
  providerPaymentId: string;
  status: string;
  amount?: number;
  currency?: string;
  paidAt?: string;
  isCurrent: boolean;
}) {
  if (!insforgeAdmin) throw new Error("InsForge admin no esta configurado.");
  if (!Number.isFinite(amount) || !currency) throw new Error("El pago no informa importe y moneda validos.");

  if (!isCurrent) {
    if (!["refunded", "charged_back"].includes(status)) return "ignored_out_of_order";
    const { data, error } = await insforgeAdmin.database.rpc("revoke_mercadopago_historical_payment", {
      p_business_id: business.id,
      p_subscription_external_id: preapproval.id,
      p_provider_payment_id: providerPaymentId,
      p_status: status,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  const { data, error } = await insforgeAdmin.database.rpc("apply_mercadopago_subscription_payment", {
    p_business_id: business.id,
    p_subscription_external_id: preapproval.id,
    p_provider_payment_id: providerPaymentId,
    p_status: status,
    p_amount_cents: Math.round(Number(amount) * 100),
    p_currency: currency,
    p_paid_at: paidAt ?? null,
    p_current_period_end: preapproval.next_payment_date ?? null,
  });
  if (error) throw new Error(error.message);
  return data;
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

    if (
      body.type === "preapproval"
      || body.type === "subscription_preapproval"
      || body.action?.includes("preapproval")
    ) {
      const preapproval = await getMercadoPagoPreapproval(dataId);
      const { isCurrent } = await getBusinessForPreapproval(preapproval);
      if (!isCurrent) {
        await finishWebhook(eventId, "ignored");
        return Response.json({ received: true, ignored: "stale_preapproval" });
      }
      const { error } = await insforgeAdmin.database.rpc("sync_business_subscription_status", {
        p_external_id: preapproval.id,
        p_status: preapproval.status,
        p_current_period_end: preapproval.next_payment_date ?? null,
      });
      if (error) throw new Error(error.message);
      await finishWebhook(eventId, "processed");
      return Response.json({ received: true });
    }

    if (body.type === "subscription_authorized_payment") {
      const authorizedPayment = await getMercadoPagoAuthorizedPayment(dataId);
      if (!authorizedPayment.preapproval_id) throw new Error("El pago autorizado no informa la suscripcion.");
      const preapproval = await getMercadoPagoPreapproval(authorizedPayment.preapproval_id);
      const providerPaymentId = String(authorizedPayment.payment?.id ?? authorizedPayment.id);
      const { business, isCurrent } = await getBusinessForPreapproval(preapproval, providerPaymentId);
      if (authorizedPayment.external_reference && authorizedPayment.external_reference !== business.id) {
        throw new Error("La referencia externa del pago no coincide.");
      }
      await applySubscriptionPayment({
        business,
        preapproval,
        providerPaymentId,
        status: authorizedPayment.payment?.status ?? authorizedPayment.status,
        amount: authorizedPayment.transaction_amount,
        currency: authorizedPayment.currency_id ?? preapproval.auto_recurring?.currency_id,
        paidAt: authorizedPayment.date_approved ?? authorizedPayment.date_created,
        isCurrent,
      });
      await finishWebhook(eventId, "processed");
      return Response.json({ received: true });
    }

    if (body.type && body.type !== "payment") {
      await finishWebhook(eventId, "ignored");
      return Response.json({ received: true, ignored: body.type });
    }

    const payment = await getMercadoPagoPayment(dataId);
    if (payment.preapproval_id) {
      const preapproval = await getMercadoPagoPreapproval(payment.preapproval_id);
      const { business, isCurrent } = await getBusinessForPreapproval(preapproval, String(payment.id));
      if (payment.external_reference && payment.external_reference !== business.id) {
        throw new Error("La referencia externa del pago no coincide.");
      }
      await applySubscriptionPayment({
        business,
        preapproval,
        providerPaymentId: String(payment.id),
        status: payment.status,
        amount: payment.transaction_amount,
        currency: payment.currency_id ?? preapproval.auto_recurring?.currency_id,
        paidAt: payment.date_approved,
        isCurrent,
      });
      await finishWebhook(eventId, "processed");
      return Response.json({ received: true });
    }

    if (!payment.external_reference) {
      await finishWebhook(eventId, "ignored");
      return Response.json({ received: true, ignored: "missing_external_reference" });
    }

    // Pagos del checkout único antiguo: ya no hay tabla payments que confirmar. Se registran como ignorados
    // y se loguean para que un pago legacy no pase desapercibido.
    console.warn("mercadopago legacy payment ignored", { eventId, externalReference: payment.external_reference });
    await finishWebhook(eventId, "ignored");
    return Response.json({ received: true, ignored: "legacy_payment" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar el webhook.";
    if (eventId) await finishWebhook(eventId, "failed", message);
    console.error("mercadopago webhook failed", { eventId, message });
    return Response.json({ error: "No se pudo procesar el webhook." }, { status: 500 });
  }
}

import { NextRequest } from "next/server";
import { hasSameOrigin } from "@/lib/blog-admin-auth";
import { createInsforgeTokenClient, getRequestAccessToken } from "@/lib/insforge-server";
import { getPayerEmailOverride, getProtectionBypassSecret } from "@/lib/env";
import { insforgeAdmin } from "@/lib/insforge-admin";
import {
  createMercadoPagoPreapproval,
  getMercadoPagoPreapproval,
  updateMercadoPagoPreapproval,
} from "@/lib/mercadopago";
import { isSubscriptionPlanId, type SubscriptionPlanId } from "@/lib/subscription-plans";
import { requireSubscriptionPlans } from "@/lib/subscription-plans-server";
import { fetchBusinessAccessState } from "@/lib/business-access";

type SubscriptionBusiness = {
  id: string;
  owner_id: string;
  trial_ends_at: string;
  promotion_ends_at: string | null;
  subscription_status: string;
  subscription_provider: string | null;
  subscription_plan: SubscriptionPlanId;
  pending_subscription_plan: SubscriptionPlanId | null;
  subscription_external_id: string | null;
  subscription_checkout_url: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
};

type OperationClaim = {
  operation_id: string | null;
  claim_state: "claimed" | "completed" | "processing" | "busy";
  operation_result: Record<string, unknown>;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getAppBaseUrl(request: NextRequest) {
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

function getWebhookUrl(origin: string) {
  const webhookUrl = new URL("/api/mercadopago/webhook", origin);
  const protectionBypass = getProtectionBypassSecret();
  if (protectionBypass) webhookUrl.searchParams.set("x-vercel-protection-bypass", protectionBypass);
  return webhookUrl.toString();
}

async function getOwnedBusiness(request: NextRequest, businessId: string) {
  const accessToken = getRequestAccessToken(request);
  if (!accessToken) return { ok: false as const, error: "Sesion requerida.", status: 401 as const };
  // Con la cookie de sesión (sin Bearer) se exige mismo origen, además de SameSite=Lax.
  if (!request.headers.get("authorization") && !hasSameOrigin(request)) {
    return { ok: false as const, error: "Solicitud no autorizada.", status: 403 as const };
  }

  const userClient = createInsforgeTokenClient(accessToken);
  const { data: authData, error: authError } = await userClient.auth.getCurrentUser();
  const user = authData?.user;
  if (authError || !user) return { ok: false as const, error: "Sesion invalida.", status: 401 as const };

  if (!insforgeAdmin) return { ok: false as const, error: "InsForge admin no esta configurado.", status: 500 as const };

  // Billing columns are intentionally hidden from authenticated clients. Authenticate
  // with the user's token first, then perform the ownership lookup server-side.
  const { data: rows, error } = await insforgeAdmin.database
    .from("businesses")
    .select("id,owner_id,trial_ends_at,promotion_ends_at,subscription_status,subscription_provider,subscription_plan,pending_subscription_plan,subscription_external_id,subscription_checkout_url,subscription_current_period_end,subscription_cancel_at_period_end")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .limit(1);
  const business = (rows?.[0] ?? null) as SubscriptionBusiness | null;
  if (error || !business) return { ok: false as const, error: "Negocio no encontrado.", status: 404 as const };

  return { ok: true as const, business, user };
}

async function claimOperation(
  requestId: string,
  businessId: string,
  operationType: "select_plan" | "cancel",
  requestedPlan: SubscriptionPlanId | null,
) {
  if (!insforgeAdmin) throw new Error("InsForge admin no esta configurado.");
  const { data, error } = await insforgeAdmin.database.rpc("claim_subscription_operation", {
    p_request_id: requestId,
    p_business_id: businessId,
    p_operation_type: operationType,
    p_requested_plan: requestedPlan,
  });
  if (error) throw new Error(error.message);
  return ((data as OperationClaim[] | null)?.[0] ?? null);
}

async function finishOperation(
  operationId: string,
  status: "completed" | "failed",
  result: Record<string, unknown> = {},
  errorMessage?: string,
) {
  if (!insforgeAdmin) return;
  const { error } = await insforgeAdmin.database.rpc("finish_subscription_operation", {
    p_operation_id: operationId,
    p_status: status,
    p_result: result,
    p_error_message: errorMessage ?? null,
  });
  if (error) console.error("subscription operation finalization failed", { operationId, message: error.message });
}

function operationResponse(claim: OperationClaim | null) {
  if (!claim) return Response.json({ error: "No se pudo iniciar la operacion." }, { status: 500 });
  if (claim.claim_state === "completed") return Response.json(claim.operation_result);
  if (claim.claim_state === "processing" || claim.claim_state === "busy") {
    return Response.json({ error: "Ya hay un cambio de suscripcion en proceso. Espera unos segundos." }, { status: 409 });
  }
  return null;
}

export async function POST(request: NextRequest) {
  let operationId: string | null = null;
  try {
    if (!insforgeAdmin) return Response.json({ error: "InsForge admin no esta configurado." }, { status: 500 });

    const body = (await request.json()) as { businessId?: string; plan?: unknown; requestId?: string };
    if (!body.businessId) return Response.json({ error: "Negocio invalido." }, { status: 400 });

    const owned = await getOwnedBusiness(request, body.businessId);
    if (!owned.ok) return Response.json({ error: owned.error }, { status: owned.status });
    let { business } = owned;
    const { user } = owned;
    if (!isSubscriptionPlanId(body.plan) || !body.requestId || !UUID_PATTERN.test(body.requestId)) {
      return Response.json({ error: "Plan o identificador de solicitud invalido." }, { status: 400 });
    }

    const claim = await claimOperation(body.requestId, business.id, "select_plan", body.plan);
    const earlyResponse = operationResponse(claim);
    if (earlyResponse) return earlyResponse;
    operationId = claim?.operation_id ?? null;
    if (!operationId) throw new Error("No se pudo reservar la operacion de suscripcion.");

    // Un canje que terminó justo antes del reclamo debe aplazar el primer cobro.
    const refreshed = await getOwnedBusiness(request, business.id);
    if (!refreshed.ok) throw new Error("No se pudo actualizar el estado del negocio.");
    business = refreshed.business;
    const currentPeriodEnd = business.subscription_current_period_end
      ? new Date(business.subscription_current_period_end)
      : null;
    const hasCurrentPaidPeriod = Boolean(currentPeriodEnd && currentPeriodEnd.getTime() > Date.now());

    if (
      business.subscription_status === "active"
      && hasCurrentPaidPeriod
      && business.subscription_plan === body.plan
      && !business.pending_subscription_plan
      && !business.subscription_cancel_at_period_end
    ) {
      const result = { unchanged: true };
      await finishOperation(operationId, "completed", result);
      return Response.json(result);
    }

    const plan = (await requireSubscriptionPlans())[body.plan];
    const origin = getAppBaseUrl(request);
    const payerEmail = getPayerEmailOverride() ?? user.email;
    if (!payerEmail) throw new Error("La cuenta no tiene un email valido.");

    const { billingStartAt } = await fetchBusinessAccessState(insforgeAdmin, business.id);
    const providerBody = {
      reason: `Citadely - Plan ${plan.name}`,
      external_reference: business.id,
      payer_email: payerEmail,
      back_url: `${origin}/negocio/configuracion?suscripcion=pendiente`,
      notification_url: getWebhookUrl(origin),
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.priceCents / 100,
        currency_id: "ARS",
        ...(billingStartAt ? { start_date: billingStartAt } : {}),
      },
    };

    let preapproval = null;
    let createdNew = false;
    if (business.subscription_external_id && !business.subscription_cancel_at_period_end) {
      const currentPreapproval = await getMercadoPagoPreapproval(business.subscription_external_id);
      if (currentPreapproval.status !== "cancelled") {
        preapproval = await updateMercadoPagoPreapproval(currentPreapproval.id, providerBody);
      }
    }

    if (!preapproval) {
      preapproval = await createMercadoPagoPreapproval({ ...providerBody, status: "pending" });
      createdNew = true;
    }

    if (!preapproval.id) throw new Error("Mercado Pago no devolvio una suscripcion valida.");

    const checkoutUrl = preapproval.init_point ?? (createdNew ? null : business.subscription_checkout_url);
    const { error: persistError } = await insforgeAdmin.database
      .from("businesses")
      .update({
        subscription_provider: "mercadopago",
        subscription_external_id: preapproval.id,
        subscription_checkout_url: checkoutUrl,
        pending_subscription_plan: body.plan,
        subscription_cancel_at_period_end: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", business.id)
      .eq("owner_id", user.id);

    if (persistError) {
      if (createdNew) await updateMercadoPagoPreapproval(preapproval.id, { status: "cancelled" }).catch(() => undefined);
      throw new Error("No se pudo vincular la suscripcion al negocio.");
    }

    const result = checkoutUrl && preapproval.status === "pending"
      ? { externalId: preapproval.id, checkoutUrl, firstChargeAt: billingStartAt }
      : {
          changeScheduled: true,
          awaitingFirstPayment: !hasCurrentPaidPeriod,
          effectiveAt: preapproval.next_payment_date ?? billingStartAt ?? (hasCurrentPaidPeriod ? business.subscription_current_period_end : null),
        };
    await finishOperation(operationId, "completed", result);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar la suscripcion.";
    if (operationId) await finishOperation(operationId, "failed", {}, message);
    console.error("subscription update failed", { message });
    return Response.json({ error: "No se pudo actualizar el plan. Intenta nuevamente." }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  let operationId: string | null = null;
  try {
    if (!insforgeAdmin) return Response.json({ error: "InsForge admin no esta configurado." }, { status: 500 });

    const body = (await request.json()) as { businessId?: string; requestId?: string };
    if (!body.businessId) return Response.json({ error: "Negocio invalido." }, { status: 400 });

    const owned = await getOwnedBusiness(request, body.businessId);
    if (!owned.ok) return Response.json({ error: owned.error }, { status: owned.status });
    const { business, user } = owned;
    if (!body.requestId || !UUID_PATTERN.test(body.requestId)) {
      return Response.json({ error: "Identificador de solicitud invalido." }, { status: 400 });
    }

    const claim = await claimOperation(body.requestId, business.id, "cancel", null);
    const earlyResponse = operationResponse(claim);
    if (earlyResponse) return earlyResponse;
    operationId = claim?.operation_id ?? null;
    if (!operationId) throw new Error("No se pudo reservar la cancelacion.");

    if (!business.subscription_external_id || business.subscription_cancel_at_period_end) {
      const result = { unchanged: true, cancelAt: business.subscription_current_period_end };
      await finishOperation(operationId, "completed", result);
      return Response.json(result);
    }

    await updateMercadoPagoPreapproval(business.subscription_external_id, { status: "cancelled" });

    const now = Date.now();
    const periodEnd = business.subscription_current_period_end
      ? new Date(business.subscription_current_period_end).getTime()
      : 0;
    const trialEnd = new Date(business.trial_ends_at).getTime();
    const hasPaidPeriod = periodEnd > now;
    const hasTrial = business.subscription_status === "trialing" && trialEnd > now;

    const { error: persistError } = await insforgeAdmin.database
      .from("businesses")
      .update({
        pending_subscription_plan: null,
        subscription_checkout_url: null,
        subscription_cancel_at_period_end: hasPaidPeriod,
        subscription_status: hasPaidPeriod ? business.subscription_status : hasTrial ? "trialing" : "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", business.id)
      .eq("owner_id", user.id);
    if (persistError) throw new Error("No se pudo guardar la cancelacion.");

    const result = { cancelled: true, cancelAt: hasPaidPeriod ? business.subscription_current_period_end : null };
    await finishOperation(operationId, "completed", result);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cancelar la suscripcion.";
    if (operationId) await finishOperation(operationId, "failed", {}, message);
    console.error("subscription cancellation failed", { message });
    return Response.json({ error: "No se pudo cancelar la suscripcion. Intenta nuevamente." }, { status: 500 });
  }
}

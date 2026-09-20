import { NextRequest } from "next/server";
import { createClient } from "@insforge/sdk";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { createMercadoPagoPreapproval, updateMercadoPagoPreapproval } from "@/lib/mercadopago";
import { getSubscriptionPlan, isSubscriptionPlanId, type SubscriptionPlanId } from "@/lib/subscription-plans";

type SubscriptionBusiness = {
  id: string;
  owner_id: string;
  subscription_status: string;
  subscription_plan: SubscriptionPlanId;
  pending_subscription_plan: SubscriptionPlanId | null;
  subscription_external_id: string | null;
  subscription_current_period_end: string | null;
};

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
    if (!insforgeAdmin) {
      return Response.json({ error: "InsForge admin no esta configurado." }, { status: 500 });
    }

    const { businessId, plan: planId } = (await request.json()) as {
      businessId?: string;
      plan?: unknown;
    };

    if (!businessId || !isSubscriptionPlanId(planId)) {
      return Response.json({ error: "Negocio o plan invalido." }, { status: 400 });
    }

    const accessToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
    const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_BASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

    if (!accessToken || !baseUrl) {
      return Response.json({ error: "Sesion requerida." }, { status: 401 });
    }

    const userClient = createClient({ baseUrl, ...(anonKey ? { anonKey } : {}), isServerMode: true });
    userClient.setAccessToken(accessToken);
    const { data: authData, error: authError } = await userClient.auth.getCurrentUser();
    const user = authData?.user;

    if (authError || !user) {
      return Response.json({ error: "Sesion invalida." }, { status: 401 });
    }

    const { data: businessRows, error: businessError } = await userClient.database
      .from("businesses")
      .select("id, owner_id, subscription_status, subscription_plan, pending_subscription_plan, subscription_external_id, subscription_current_period_end")
      .eq("id", businessId)
      .eq("owner_id", user.id)
      .limit(1);
    const business = (businessRows?.[0] ?? null) as SubscriptionBusiness | null;

    if (businessError || !business) {
      return Response.json({ error: "Negocio no encontrado." }, { status: 404 });
    }

    const origin = getAppBaseUrl(request);
    const mercadoPagoPayerEmail = process.env.MERCADOPAGO_PAYER_EMAIL ?? user.email;
    const plan = getSubscriptionPlan(planId);

    if (!mercadoPagoPayerEmail) {
      return Response.json({ error: "La cuenta no tiene un email valido." }, { status: 400 });
    }

    if (business.subscription_status === "active" && business.subscription_external_id) {
      if (business.subscription_plan === planId && !business.pending_subscription_plan) {
        return Response.json({ unchanged: true });
      }

      if (business.pending_subscription_plan === planId) {
        return Response.json({ changeScheduled: true, effectiveAt: business.subscription_current_period_end });
      }

      await updateMercadoPagoPreapproval(business.subscription_external_id, {
        reason: `Citadely - Plan ${plan.name}`,
        auto_recurring: {
          transaction_amount: plan.priceCents / 100,
          currency_id: "ARS",
        },
      });

      if (business.subscription_plan === planId && business.pending_subscription_plan) {
        const { error: cancelPendingError } = await insforgeAdmin.database
          .from("businesses")
          .update({ pending_subscription_plan: null, updated_at: new Date().toISOString() })
          .eq("id", business.id)
          .eq("owner_id", user.id);
        if (cancelPendingError) {
          const pendingPlan = getSubscriptionPlan(business.pending_subscription_plan);
          await updateMercadoPagoPreapproval(business.subscription_external_id, {
            reason: `Citadely - Plan ${pendingPlan.name}`,
            auto_recurring: { transaction_amount: pendingPlan.priceCents / 100, currency_id: "ARS" },
          }).catch(() => undefined);
          throw new Error("No se pudo cancelar el cambio pendiente.");
        }
        return Response.json({ cancelledPending: true });
      }

      const { error: updateError } = await insforgeAdmin.database
        .from("businesses")
        .update({ pending_subscription_plan: planId, updated_at: new Date().toISOString() })
        .eq("id", business.id)
        .eq("owner_id", user.id);

      if (updateError) {
        const previousPlan = getSubscriptionPlan(business.subscription_plan);
        await updateMercadoPagoPreapproval(business.subscription_external_id, {
          reason: `Citadely - Plan ${previousPlan.name}`,
          auto_recurring: { transaction_amount: previousPlan.priceCents / 100, currency_id: "ARS" },
        }).catch(() => undefined);
        throw new Error("No se pudo guardar el cambio de plan.");
      }

      return Response.json({ changeScheduled: true, effectiveAt: business.subscription_current_period_end });
    }

    const preapproval = await createMercadoPagoPreapproval({
      reason: `Citadely - Plan ${plan.name}`,
      external_reference: businessId,
      payer_email: mercadoPagoPayerEmail,
      back_url: `${origin}/negocio`,
      notification_url: `${origin}/api/mercadopago/webhook`,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: plan.priceCents / 100,
        currency_id: "ARS",
      },
    });

    if (!preapproval.id || !preapproval.init_point) {
      return Response.json({ error: "Mercado Pago no devolvio URL de suscripcion." }, { status: 502 });
    }

    const { error: persistError } = await insforgeAdmin.database
      .from("businesses")
      .update({
        subscription_provider: "mercadopago",
        subscription_external_id: preapproval.id,
        subscription_checkout_url: preapproval.init_point,
        pending_subscription_plan: planId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", business.id)
      .eq("owner_id", user.id);

    if (persistError) {
      await updateMercadoPagoPreapproval(preapproval.id, { status: "cancelled" }).catch(() => undefined);
      throw new Error("No se pudo vincular la suscripcion al negocio.");
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

import crypto from "node:crypto";
import { NextRequest } from "next/server";
import { hasSameOrigin } from "@/lib/blog-admin-auth";
import { CONTRIBUTION_CURRENCY, parseContributionAmount, type ContributionOption } from "@/lib/contributions";
import { isProduction } from "@/lib/env";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { createInsforgeTokenClient, getRequestAccessToken } from "@/lib/insforge-server";
import { createMercadoPagoPreference, getAppBaseUrl, getWebhookUrl } from "@/lib/mercadopago";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CheckoutBody = { businessId?: unknown; optionCode?: unknown; amountCents?: unknown };

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

  // Authenticate with the user's token first, then perform the ownership lookup server-side.
  const { data: rows, error } = await insforgeAdmin.database
    .from("businesses")
    .select("id,owner_id,is_demo")
    .eq("id", businessId)
    .eq("owner_id", user.id)
    .limit(1);
  const business = (rows?.[0] ?? null) as { id: string; owner_id: string; is_demo: boolean | null } | null;
  if (error || !business) return { ok: false as const, error: "Negocio no encontrado.", status: 404 as const };

  return { ok: true as const, business, user };
}

// Mercado Pago no redirige a dominios locales: auto_return solo se pide con un origen público.
function isPublicHttpsOrigin(origin: string) {
  const { protocol, hostname } = new URL(origin);
  return protocol === "https:" && hostname !== "localhost" && hostname !== "127.0.0.1";
}

export async function POST(request: NextRequest) {
  if (!insforgeAdmin) return Response.json({ error: "InsForge admin no esta configurado." }, { status: 500 });

  const body = (await request.json().catch(() => null)) as CheckoutBody | null;
  if (!body || typeof body.businessId !== "string" || !UUID_PATTERN.test(body.businessId)) {
    return Response.json({ error: "Negocio invalido." }, { status: 400 });
  }

  const owned = await getOwnedBusiness(request, body.businessId);
  if (!owned.ok) return Response.json({ error: owned.error }, { status: owned.status });
  const { business, user } = owned;
  // La cuenta demo es pública: en producción no puede iniciar pagos reales.
  if (isProduction && business.is_demo) {
    return Response.json({ error: "La cuenta demo no puede hacer aportes." }, { status: 403 });
  }

  const { data: optionRows, error: optionsError } = await insforgeAdmin.database
    .from("contribution_options")
    .select("code,label,amount_cents,currency,sort_order")
    .eq("is_active", true);
  if (optionsError) {
    console.error("contribution options query failed", { message: optionsError.message });
    return Response.json({ error: "No se pudo iniciar el aporte. Intenta nuevamente." }, { status: 500 });
  }

  const amount = parseContributionAmount(
    { optionCode: body.optionCode, amountCents: body.amountCents },
    (optionRows ?? []) as ContributionOption[],
  );
  if (!amount.ok) return Response.json({ error: amount.error }, { status: 400 });

  const contributionId = crypto.randomUUID();
  const { error: insertError } = await insforgeAdmin.database.from("contributions").insert([{
    id: contributionId,
    business_id: business.id,
    user_id: user.id,
    amount_cents: amount.amountCents,
    currency: CONTRIBUTION_CURRENCY,
    status: "pending",
    provider: "mercadopago",
    external_reference: contributionId,
    payer_email: user.email ?? null,
    option_code: amount.optionCode,
  }]);
  if (insertError) {
    console.error("contribution insert failed", { message: insertError.message });
    return Response.json({ error: "No se pudo iniciar el aporte. Intenta nuevamente." }, { status: 500 });
  }

  const origin = getAppBaseUrl(request);
  const returnUrl = (result: "aprobado" | "pendiente" | "fallido") => `${origin}/negocio/configuracion?aporte=${result}`;

  let preference;
  try {
    preference = await createMercadoPagoPreference({
      items: [{
        id: contributionId,
        title: "Aporte a Citadely",
        quantity: 1,
        unit_price: amount.amountCents / 100,
        currency_id: CONTRIBUTION_CURRENCY,
      }],
      external_reference: contributionId,
      metadata: { contribution_id: contributionId, business_id: business.id },
      ...(user.email ? { payer: { email: user.email } } : {}),
      back_urls: { success: returnUrl("aprobado"), pending: returnUrl("pendiente"), failure: returnUrl("fallido") },
      ...(isPublicHttpsOrigin(origin) ? { auto_return: "approved" } : {}),
      notification_url: getWebhookUrl(origin),
      statement_descriptor: "CITADELY",
      binary_mode: true,
    });
  } catch (error) {
    console.error("mercadopago preference failed", { message: error instanceof Error ? error.message : String(error) });
    // Sin preferencia el aporte no puede pagarse: no se deja una fila pendiente huérfana.
    await insforgeAdmin.database.from("contributions").delete().eq("id", contributionId);
    return Response.json({ error: "Mercado Pago no respondió. Intenta nuevamente." }, { status: 502 });
  }

  const checkoutUrl = preference.init_point ?? preference.sandbox_init_point;
  if (!preference.id || !checkoutUrl) {
    console.error("mercadopago preference without checkout url", { preferenceId: preference.id });
    await insforgeAdmin.database.from("contributions").delete().eq("id", contributionId);
    return Response.json({ error: "Mercado Pago no respondió. Intenta nuevamente." }, { status: 502 });
  }

  const { error: updateError } = await insforgeAdmin.database
    .from("contributions")
    .update({ provider_preference_id: preference.id, updated_at: new Date().toISOString() })
    .eq("id", contributionId);
  // El webhook vincula el pago por external_reference; sin el id de preferencia el aporte igual se aplica.
  if (updateError) console.error("contribution preference id update failed", { message: updateError.message });

  return Response.json({ contributionId, checkoutUrl });
}

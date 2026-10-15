import { NextResponse } from "next/server";
import { hasSameOrigin } from "@/lib/blog-admin-auth";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { createInsforgeTokenClient, getRequestAccessToken } from "@/lib/insforge-server";
import { getMercadoPagoPreapproval } from "@/lib/mercadopago";
import { normalizePromoCode, promoCodeHash } from "@/lib/promo-codes";

export const dynamic = "force-dynamic";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RedeemBusiness = {
  id: string;
  owner_id: string;
  subscription_external_id: string | null;
  subscription_cancel_at_period_end: boolean;
};

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) return NextResponse.json({ error: "Solicitud no autorizada." }, { status: 403 });
  if (!insforgeAdmin) return NextResponse.json({ error: "Backend no configurado." }, { status: 503 });

  const accessToken = getRequestAccessToken(request);
  if (!accessToken) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const userClient = createInsforgeTokenClient(accessToken);
  const { data: authData, error: authError } = await userClient.auth.getCurrentUser();
  if (authError || !authData?.user) return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });

  let businessId: string;
  let normalizedCode: string | null;
  try {
    const body = await request.json() as { businessId?: unknown; code?: unknown };
    if (typeof body.businessId !== "string" || !UUID_PATTERN.test(body.businessId)) throw new Error("invalid");
    businessId = body.businessId;
    normalizedCode = normalizePromoCode(body.code);
  } catch {
    return NextResponse.json({ error: "Código o negocio inválido." }, { status: 400 });
  }

  const { data: rows, error: businessError } = await insforgeAdmin.database.from("businesses")
    .select("id,owner_id,subscription_external_id,subscription_cancel_at_period_end")
    .eq("id", businessId).eq("owner_id", authData.user.id).limit(1);
  const business = (rows?.[0] ?? null) as RedeemBusiness | null;
  if (businessError || !business) return NextResponse.json({ error: "Negocio no encontrado." }, { status: 404 });

  // Una preaprobación pendiente también puede cobrar al acabar la prueba.
  if (business.subscription_external_id) {
    if (!business.subscription_cancel_at_period_end) {
      return NextResponse.json({ error: "Cancelá la suscripción antes de canjear un código." }, { status: 409 });
    }
    try {
      const preapproval = await getMercadoPagoPreapproval(business.subscription_external_id);
      if (preapproval.status !== "cancelled") {
        return NextResponse.json({ error: "La cancelación de Mercado Pago aún no se confirmó." }, { status: 409 });
      }
    } catch {
      return NextResponse.json({ error: "No pudimos verificar la cancelación en Mercado Pago. Intentá de nuevo." }, { status: 503 });
    }
  }

  const { data: allowed, error: attemptError } = await insforgeAdmin.database.rpc("claim_promo_redemption_attempt", {
    p_user_id: authData.user.id,
  });
  if (attemptError) return NextResponse.json({ error: "No se pudo validar el intento." }, { status: 500 });
  if (!allowed) return NextResponse.json({ error: "Demasiados intentos. Intentá de nuevo en 15 minutos." }, { status: 429 });
  if (!normalizedCode) return NextResponse.json({ error: "Código inválido o agotado." }, { status: 400 });

  const { data, error } = await insforgeAdmin.database.rpc("redeem_promo_code", {
    p_business_id: businessId,
    p_user_id: authData.user.id,
    p_code_hash: promoCodeHash(normalizedCode),
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("Verifica tu email")) return NextResponse.json({ error: "Verificá tu email antes de canjear un código." }, { status: 403 });
    if (message.includes("ya canjeo")) return NextResponse.json({ error: "Este email ya canjeó un código." }, { status: 409 });
    if (message.includes("fin del periodo") || message.includes("suscripcion en curso")) {
      return NextResponse.json({ error: "Terminá o cancelá tu suscripción antes de canjear un código." }, { status: 409 });
    }
    if (message.includes("Codigo invalido")) return NextResponse.json({ error: "Código inválido o agotado." }, { status: 400 });
    return NextResponse.json({ error: "No se pudo canjear el código." }, { status: 500 });
  }

  const redemption = (Array.isArray(data) ? data[0] : data) as { starts_at: string; ends_at: string } | null;
  return NextResponse.json({ startsAt: redemption?.starts_at, endsAt: redemption?.ends_at }, {
    headers: { "Cache-Control": "no-store" },
  });
}

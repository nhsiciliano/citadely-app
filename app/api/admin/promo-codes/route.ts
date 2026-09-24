import { NextResponse } from "next/server";
import { hasAdminRequest, hasSameOrigin } from "@/lib/blog-admin-auth";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { generatePromoCode, normalizePromoCode, promoCodeHash, validPromoSettings } from "@/lib/promo-codes";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return NextResponse.json({ error: "Backend no configurado." }, { status: 503 });

  const { data, error } = await insforgeAdmin.database.rpc("list_promo_codes");
  if (error) return NextResponse.json({ error: "No se pudieron cargar los códigos." }, { status: 500 });
  return NextResponse.json({ codes: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!hasAdminRequest(request) || !hasSameOrigin(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return NextResponse.json({ error: "Backend no configurado." }, { status: 503 });

  let durationDays: number;
  let maxUses: number;
  try {
    const input = await request.json() as { durationDays?: unknown; maxUses?: unknown };
    if (!validPromoSettings(input.durationDays, input.maxUses)) throw new Error("invalid");
    durationDays = input.durationDays as number;
    maxUses = input.maxUses as number;
  } catch {
    return NextResponse.json({ error: "Ingresá entre 1 y 365 días y entre 1 y 1.000 usos." }, { status: 400 });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = generatePromoCode();
    const normalized = normalizePromoCode(code);
    if (!normalized) throw new Error("Código generado inválido.");
    const { error } = await insforgeAdmin.database.from("promo_codes").insert([{
      code_hash: promoCodeHash(normalized),
      code_hint: normalized.slice(-4),
      duration_days: durationDays,
      max_uses: maxUses,
    }]);
    if (!error) return NextResponse.json({ code }, { status: 201, headers: { "Cache-Control": "no-store" } });
    if (String((error as { code?: string }).code) !== "23505") break;
  }
  return NextResponse.json({ error: "No se pudo crear el código." }, { status: 500 });
}

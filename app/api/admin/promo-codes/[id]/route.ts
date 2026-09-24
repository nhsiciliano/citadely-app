import { NextResponse } from "next/server";
import { hasAdminRequest, hasSameOrigin } from "@/lib/blog-admin-auth";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { validPromoSettings } from "@/lib/promo-codes";

export const dynamic = "force-dynamic";
type Params = { params: Promise<{ id: string }> };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: Params) {
  if (!hasAdminRequest(request) || !hasSameOrigin(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return NextResponse.json({ error: "Backend no configurado." }, { status: 503 });
  const id = (await params).id;
  if (!UUID_PATTERN.test(id)) return NextResponse.json({ error: "Código inválido." }, { status: 400 });

  let durationDays: number;
  let maxUses: number;
  let isActive: boolean;
  try {
    const input = await request.json() as { durationDays?: unknown; maxUses?: unknown; isActive?: unknown };
    if (!validPromoSettings(input.durationDays, input.maxUses) || typeof input.isActive !== "boolean") throw new Error("invalid");
    durationDays = input.durationDays as number;
    maxUses = input.maxUses as number;
    isActive = input.isActive;
  } catch {
    return NextResponse.json({ error: "Ingresá entre 1 y 365 días y entre 1 y 1.000 usos." }, { status: 400 });
  }

  const { error } = await insforgeAdmin.database.rpc("update_promo_code", {
    p_id: id, p_duration_days: durationDays, p_max_uses: maxUses, p_is_active: isActive,
  });
  if (error) {
    const message = error.message ?? "";
    if (message.includes("cupo no puede")) return NextResponse.json({ error: "El cupo no puede ser menor a los usos realizados." }, { status: 400 });
    if (message.includes("Codigo no encontrado")) return NextResponse.json({ error: "Código no encontrado." }, { status: 404 });
    return NextResponse.json({ error: "No se pudo guardar el código." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

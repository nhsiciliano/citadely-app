import { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { reconcileSubscriptions } from "@/lib/subscription-reconciliation";

export const runtime = "nodejs";
export const maxDuration = 300;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handle(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return Response.json({ error: "InsForge admin no está configurado." }, { status: 500 });

  // ?businessId= limita la corrida a un negocio (soporte y E2E); el cron diario no lo envía.
  const businessId = request.nextUrl.searchParams.get("businessId") ?? undefined;
  if (businessId && !UUID_PATTERN.test(businessId)) return Response.json({ error: "Negocio inválido." }, { status: 400 });

  try {
    const report = await reconcileSubscriptions(insforgeAdmin, { businessId });
    const needsAttention = report.errors.length + report.orphans.reported.length + (report.orphans.searchError ? 1 : 0);
    if (needsAttention > 0) {
      const message = `Citadely: la reconciliación de Mercado Pago encontró ${needsAttention} caso(s) para revisar`;
      console.error(message, { errors: report.errors, orphans: report.orphans });
      if (process.env.SENTRY_DSN) {
        const Sentry = await import("@sentry/nextjs");
        Sentry.captureMessage(message, { level: "error", extra: { errors: report.errors, orphans: report.orphans } });
        await Sentry.flush(2000);
      }
    }
    return Response.json(report);
  } catch (error) {
    console.error("subscription reconciliation failed", { message: error instanceof Error ? error.message : String(error) });
    return Response.json({ error: "No se pudo reconciliar las suscripciones." }, { status: 500 });
  }
}

// Vercel Cron sends GET; POST is kept for manual runs.
export { handle as GET, handle as POST };

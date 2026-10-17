import { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { insforgeAdmin } from "@/lib/insforge-admin";

export const runtime = "nodejs";

// Slightly longer than the 15 min schedule so a late run never leaves a gap.
const WINDOW_MS = 20 * 60 * 1000;
const SAMPLE_LIMIT = 50;

const WATCHED_TABLES = [
  { table: "email_outbox", errorColumn: "last_error" },
  { table: "subscription_webhook_events", errorColumn: "error_message" },
] as const;

async function handle(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return Response.json({ error: "InsForge admin no está configurado." }, { status: 500 });

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const failures: Record<string, number> = {};

  for (const { table, errorColumn } of WATCHED_TABLES) {
    const { data, error } = await insforgeAdmin.database
      .from(table)
      .select(`id, ${errorColumn}`)
      .eq("status", "failed")
      .gte("updated_at", since)
      .limit(SAMPLE_LIMIT);

    if (error) {
      console.error("failure alert query failed", { table, message: error.message });
      return Response.json({ error: "No se pudo consultar el estado." }, { status: 500 });
    }
    failures[table] = data?.length ?? 0;
  }

  const total = Object.values(failures).reduce((sum, count) => sum + count, 0);
  if (total > 0) {
    const message = `Citadely: ${total} registro(s) en estado failed en los últimos 20 minutos`;
    console.error(message, failures);
    if (process.env.SENTRY_DSN) {
      const Sentry = await import("@sentry/nextjs");
      Sentry.captureMessage(message, { level: "error", extra: failures });
      await Sentry.flush(2000);
    }
  }

  return Response.json({ failures });
}

export { handle as GET, handle as POST };

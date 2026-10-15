import { NextRequest } from "next/server";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { renderOutboxEmail, type EmailOutboxRow } from "@/lib/email-outbox";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { PermanentEmailError, sendOutboxEmail } from "@/lib/resend";

export const runtime = "nodejs";
export const maxDuration = 60;

async function processEmail(row: EmailOutboxRow) {
  if (!insforgeAdmin) throw new Error("InsForge admin no está configurado");

  try {
    const email = await renderOutboxEmail(row);
    const sent = await sendOutboxEmail(row, email);
    const { error } = await insforgeAdmin.database.rpc("complete_email_outbox", {
      p_id: row.id,
      p_provider_id: sent.id,
    });
    if (error) throw new Error(error.message);
    return { id: row.id, status: "sent" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    const rpcName = error instanceof PermanentEmailError ? "fail_email_outbox" : "retry_email_outbox";
    const { error: retryError } = await insforgeAdmin.database.rpc(rpcName, {
      p_id: row.id,
      p_error: message,
    });
    if (retryError) console.error("email outbox retry update failed", { id: row.id, message: retryError.message });
    return { id: row.id, status: error instanceof PermanentEmailError ? "failed" as const : "retry" as const, error: message };
  }
}

async function handle(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) return Response.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return Response.json({ error: "InsForge admin no está configurado." }, { status: 500 });

  const cancellationResult = await insforgeAdmin.database.rpc("cancel_expired_deposit_bookings");
  if (cancellationResult.error) {
    console.error("expired deposit cancellation failed", { message: cancellationResult.error.message });
  }

  const { data, error } = await insforgeAdmin.database.rpc("claim_email_outbox", { p_limit: 20 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as EmailOutboxRow[];
  const results = await Promise.all(rows.map(processEmail));
  const sent = results.filter((result) => result.status === "sent").length;
  const failed = results.filter((result) => result.status === "failed").length;

  return Response.json({
    claimed: rows.length,
    sent,
    failed,
    retrying: rows.length - sent - failed,
    expiredBookingsCancelled: cancellationResult.data ?? 0,
  });
}

// Vercel Cron sends GET; POST is kept for manual and legacy scheduler calls.
export { handle as GET, handle as POST };

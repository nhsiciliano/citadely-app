import { createHash } from "node:crypto";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { getResend } from "@/lib/resend";

export const runtime = "nodejs";

const TRACKED_EVENTS = new Set([
  "email.delivered",
  "email.bounced",
  "email.complained",
  "email.suppressed",
  "email.failed",
]);

export async function POST(request: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret || !insforgeAdmin) {
    return Response.json({ error: "Webhook no configurado." }, { status: 503 });
  }

  const payload = await request.text();
  let event;

  try {
    event = getResend().webhooks.verify({
      payload,
      webhookSecret,
      headers: {
        id: request.headers.get("svix-id") ?? "",
        timestamp: request.headers.get("svix-timestamp") ?? "",
        signature: request.headers.get("svix-signature") ?? "",
      },
    });
  } catch {
    return Response.json({ error: "Firma inválida." }, { status: 401 });
  }

  if (!TRACKED_EVENTS.has(event.type) || !("email_id" in event.data)) {
    return Response.json({ received: true, tracked: false });
  }

  const eventKey = createHash("sha256")
    .update(`${event.type}:${event.data.email_id}:${event.created_at}`)
    .digest("hex");
  const { data, error } = await insforgeAdmin.database.rpc("record_email_webhook", {
    p_event_key: eventKey,
    p_provider_id: event.data.email_id,
    p_event_type: event.type,
    p_payload: JSON.parse(payload),
  });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ received: true, tracked: true, inserted: data });
}


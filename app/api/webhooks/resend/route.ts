import { createHash } from "node:crypto";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { CONTACT_EMAIL, forwardContactEmail } from "@/lib/contact-email";
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
  if (!webhookSecret) {
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

  if (event.type === "email.received") {
    const recipients = [...(event.data.to ?? []), ...(event.data.received_for ?? [])];
    const isContactEmail = recipients.some((recipient) => recipient.trim().toLowerCase() === CONTACT_EMAIL);
    if (!isContactEmail) return Response.json({ received: true, forwarded: false });

    try {
      await forwardContactEmail(event.data.email_id);
      return Response.json({ received: true, forwarded: true });
    } catch (error) {
      console.error("contact email forwarding failed", {
        emailId: event.data.email_id,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
      return Response.json({ error: "No se pudo reenviar el correo." }, { status: 500 });
    }
  }

  if (!TRACKED_EVENTS.has(event.type) || !("email_id" in event.data)) {
    return Response.json({ received: true, tracked: false });
  }

  if (!insforgeAdmin) return Response.json({ error: "Webhook no configurado." }, { status: 503 });

  const eventKey = createHash("sha256")
    .update(`${event.type}:${event.data.email_id}:${event.created_at}`)
    .digest("hex");
  const { data, error } = await insforgeAdmin.database.rpc("record_email_webhook", {
    p_event_key: eventKey,
    p_provider_id: event.data.email_id,
    p_event_type: event.type,
    p_payload: JSON.parse(payload),
  });

  if (error) {
    console.error("resend webhook record failed", { message: error.message });
    return Response.json({ error: "No se pudo registrar el evento." }, { status: 500 });
  }
  return Response.json({ received: true, tracked: true, inserted: data });
}

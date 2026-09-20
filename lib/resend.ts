import "server-only";

import { Resend } from "resend";
import type { EmailOutboxRow, RenderedOutboxEmail } from "@/lib/email-outbox";

let resendClient: Resend | null = null;

const PERMANENT_RESEND_ERRORS = new Set([
  "invalid_api_key",
  "invalid_idempotency_key",
  "invalid_parameter",
  "missing_required_field",
  "restricted_api_key",
  "validation_error",
]);

export class PermanentEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PermanentEmailError";
  }
}

export function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Falta RESEND_API_KEY");
  resendClient ??= new Resend(apiKey);
  return resendClient;
}

export async function sendOutboxEmail(row: EmailOutboxRow, email: RenderedOutboxEmail) {
  if (process.env.RESEND_SKIP_DELIVERY === "true") return { id: `skipped-${row.id}` };

  const from = process.env.RESEND_FROM_EMAIL || "notificaciones@citadely.com.ar";
  const { data, error } = await getResend().emails.send({
    from: `Citadely <${from}>`,
    to: row.recipient_email,
    replyTo: row.reply_to || undefined,
    subject: email.subject,
    html: email.html,
    text: email.text,
    attachments: email.attachments,
    tags: [
      { name: "event", value: row.event_type.replaceAll("_", "-") },
      { name: "recipient", value: row.recipient_kind },
    ],
  }, { idempotencyKey: row.idempotency_key });

  if (error) {
    const ErrorType = PERMANENT_RESEND_ERRORS.has(error.name) ? PermanentEmailError : Error;
    throw new ErrorType(error.message);
  }
  if (!data?.id) throw new Error("Resend no devolvió un identificador");
  return data;
}

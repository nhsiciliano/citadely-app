import "server-only";

import { getResend } from "@/lib/resend";

export const CONTACT_EMAIL = "contacto@citadely.com.ar";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

export async function forwardContactEmail(emailId: string) {
  const destination = process.env.RESEND_CONTACT_FORWARD_TO;
  if (!destination) throw new Error("Falta RESEND_CONTACT_FORWARD_TO en el entorno.");

  const resend = getResend();
  const { data: email, error: emailError } = await resend.emails.receiving.get(emailId, { html_format: "cid" });
  if (emailError || !email) throw new Error(emailError?.message ?? "No se pudo recuperar el correo recibido.");

  const { data: attachmentList, error: attachmentError } = await resend.emails.receiving.attachments.list({ emailId });
  if (attachmentError || !attachmentList) {
    throw new Error(attachmentError?.message ?? "No se pudieron recuperar los archivos adjuntos.");
  }

  const attachments = await Promise.all(attachmentList.data.map(async (attachment) => {
    const response = await fetch(attachment.download_url);
    if (!response.ok) throw new Error("No se pudo descargar un archivo adjunto.");

    return {
      filename: attachment.filename ?? "adjunto",
      content: Buffer.from(await response.arrayBuffer()),
      contentType: attachment.content_type,
      ...(attachment.content_id ? { contentId: attachment.content_id.replace(/^<|>$/g, "") } : {}),
    };
  }));

  const sender = email.from;
  const replyAddress = email.reply_to?.[0] ?? sender;
  const replyTo = replyAddress.match(/<([^<>]+)>/)?.[1] ?? replyAddress;
  const originalSubject = email.subject || "Sin asunto";
  const intro = `Mensaje recibido en ${CONTACT_EMAIL}\nDe: ${sender}\n\n`;
  const htmlIntro = `<p><strong>Mensaje recibido en ${CONTACT_EMAIL}</strong><br />De: ${escapeHtml(sender)}</p><hr />`;
  const { data, error } = await resend.emails.send({
    from: `Citadely <${CONTACT_EMAIL}>`,
    to: destination,
    replyTo,
    subject: `Contacto Citadely: ${originalSubject}`,
    text: `${intro}${email.text ?? ""}`,
    ...(email.html ? { html: `${htmlIntro}${email.html}` } : {}),
    ...(attachments.length ? { attachments } : {}),
  }, { idempotencyKey: `citadely-contact-${emailId}` });

  if (error || !data) throw new Error(error?.message ?? "No se pudo reenviar el correo.");
  return data.id;
}

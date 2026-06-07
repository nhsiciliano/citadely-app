import "server-only";
import { formatCurrency, getBookingAmountCents, type Business, type Service } from "@/lib/citadely-db";

const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

export type PublicBookingEmailContext = {
  appointmentId: string;
  business: Business;
  service: Service;
  startsAt: string;
  endsAt: string;
  status: string;
  amountCents: number;
  depositExpiresAt: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientMessage: string;
};

export type EmailAttachment = {
  filename: string;
  content: string;
};

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeIcsText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,")
    .replaceAll(/\r?\n/g, "\\n");
}

function formatUtcForIcs(value: string) {
  return new Date(value).toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function formatBookingDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(new Date(value));
}

function buildDepositLines(context: PublicBookingEmailContext) {
  if (context.amountCents <= 0) {
    return {
      statusLabel: "Reserva confirmada",
      html: "<p>Tu reserva quedo confirmada.</p>",
      text: "Tu reserva quedo confirmada.",
    };
  }

  const currency = context.business.currency;
  const expires = context.depositExpiresAt
    ? formatBookingDate(context.depositExpiresAt, context.business.timezone || DEFAULT_TIMEZONE)
    : null;
  const lines = [
    `Estado: pendiente de sena.`,
    `Monto de sena: ${formatCurrency(context.amountCents, currency)}.`,
    expires ? `Vencimiento: ${expires}.` : "",
    context.business.payment_alias ? `Alias: ${context.business.payment_alias}.` : "",
    context.business.payment_cbu ? `CBU/CVU: ${context.business.payment_cbu}.` : "",
    context.business.payment_instructions ?? "",
  ].filter(Boolean);

  return {
    statusLabel: "Pre-reserva pendiente de sena",
    html: `
      <p>Tu pre-reserva fue creada y queda pendiente hasta que el negocio confirme la sena.</p>
      <ul>
        ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
      </ul>
    `,
    text: lines.join("\n"),
  };
}

function emailShell(title: string, body: string) {
  return `
    <div style="margin:0;background:#f7f4ec;padding:32px 16px;font-family:Arial,sans-serif;color:#16201d;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #ded8cc;border-radius:18px;padding:28px;">
        <p style="margin:0 0 12px;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:#2f6f58;font-weight:700;">Citadely</p>
        <h1 style="margin:0 0 20px;font-size:28px;line-height:1.2;">${escapeHtml(title)}</h1>
        <div style="font-size:15px;line-height:1.65;color:#24302c;">${body}</div>
      </div>
    </div>
  `;
}

export function buildCalendarAttachment(context: PublicBookingEmailContext) {
  const timezone = context.business.timezone || DEFAULT_TIMEZONE;
  const deposit = buildDepositLines(context);
  const description = [
    `${deposit.statusLabel}`,
    `Negocio: ${context.business.name}`,
    `Servicio: ${context.service.name}`,
    `Cliente: ${context.clientName}`,
    context.clientPhone ? `Telefono: ${context.clientPhone}` : "",
    context.clientMessage ? `Nota: ${context.clientMessage}` : "",
    context.amountCents > 0 ? `Sena: ${formatCurrency(context.amountCents, context.business.currency)}` : "",
    context.business.payment_alias ? `Alias: ${context.business.payment_alias}` : "",
    context.business.payment_cbu ? `CBU/CVU: ${context.business.payment_cbu}` : "",
    context.business.payment_instructions ?? "",
  ].filter(Boolean);

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Citadely//Reservas//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-TIMEZONE:${timezone}`,
    "BEGIN:VEVENT",
    `UID:citadely-${context.appointmentId}@citadely.com.ar`,
    `DTSTAMP:${formatUtcForIcs(new Date().toISOString())}`,
    `DTSTART:${formatUtcForIcs(context.startsAt)}`,
    `DTEND:${formatUtcForIcs(context.endsAt)}`,
    `SUMMARY:${escapeIcsText(`${context.service.name} - ${context.business.name}`)}`,
    `DESCRIPTION:${escapeIcsText(description.join("\n"))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return {
    filename: "turno-citadely.ics",
    content: Buffer.from(ics, "utf8").toString("base64"),
  };
}

export function buildClientBookingEmail(context: PublicBookingEmailContext) {
  const timezone = context.business.timezone || DEFAULT_TIMEZONE;
  const deposit = buildDepositLines(context);
  const date = formatBookingDate(context.startsAt, timezone);
  const price = formatCurrency(context.service.price_cents, context.business.currency);
  const html = emailShell(
    `${deposit.statusLabel}: ${context.service.name}`,
    `
      <p>Hola ${escapeHtml(context.clientName)}, estos son los datos de tu turno.</p>
      <p><strong>Negocio:</strong> ${escapeHtml(context.business.name)}<br />
      <strong>Servicio:</strong> ${escapeHtml(context.service.name)}<br />
      <strong>Fecha y hora:</strong> ${escapeHtml(date)}<br />
      <strong>Duracion:</strong> ${context.service.duration_minutes} minutos<br />
      <strong>Valor:</strong> ${escapeHtml(price)}</p>
      ${deposit.html}
      <p>Adjuntamos un archivo de calendario para que puedas agregar el turno a Google Calendar, Apple Calendar u otra app compatible.</p>
    `,
  );

  const text = [
    `Hola ${context.clientName}, estos son los datos de tu turno.`,
    `Negocio: ${context.business.name}`,
    `Servicio: ${context.service.name}`,
    `Fecha y hora: ${date}`,
    `Duracion: ${context.service.duration_minutes} minutos`,
    `Valor: ${price}`,
    deposit.text,
    "Adjuntamos un archivo de calendario para agregar el turno a tu agenda.",
  ].join("\n");

  return {
    subject: `${deposit.statusLabel}: ${context.service.name}`,
    html,
    text,
    attachments: [buildCalendarAttachment(context)],
  };
}

export function buildOwnerBookingEmail(context: PublicBookingEmailContext) {
  const timezone = context.business.timezone || DEFAULT_TIMEZONE;
  const deposit = buildDepositLines(context);
  const date = formatBookingDate(context.startsAt, timezone);
  const amount = context.amountCents || getBookingAmountCents(context.service);
  const html = emailShell(
    `Nueva reserva: ${context.service.name}`,
    `
      <p>Se creo una reserva publica para ${escapeHtml(context.business.name)}.</p>
      <p><strong>Estado:</strong> ${escapeHtml(deposit.statusLabel)}<br />
      <strong>Servicio:</strong> ${escapeHtml(context.service.name)}<br />
      <strong>Fecha y hora:</strong> ${escapeHtml(date)}<br />
      <strong>Cliente:</strong> ${escapeHtml(context.clientName)}<br />
      <strong>Email:</strong> ${escapeHtml(context.clientEmail)}<br />
      <strong>Telefono:</strong> ${escapeHtml(context.clientPhone)}</p>
      <p><strong>Sena:</strong> ${escapeHtml(formatCurrency(amount, context.business.currency))}</p>
      ${context.clientMessage ? `<p><strong>Nota:</strong> ${escapeHtml(context.clientMessage)}</p>` : ""}
    `,
  );
  const text = [
    `Nueva reserva publica para ${context.business.name}.`,
    `Estado: ${deposit.statusLabel}`,
    `Servicio: ${context.service.name}`,
    `Fecha y hora: ${date}`,
    `Cliente: ${context.clientName}`,
    `Email: ${context.clientEmail}`,
    `Telefono: ${context.clientPhone}`,
    `Sena: ${formatCurrency(amount, context.business.currency)}`,
    context.clientMessage ? `Nota: ${context.clientMessage}` : "",
  ].filter(Boolean).join("\n");

  return {
    subject: `Nueva reserva: ${context.service.name}`,
    html,
    text,
  };
}

export async function sendResendEmail(input: SendEmailInput) {
  if (process.env.RESEND_SKIP_DELIVERY === "true") {
    return { id: "skipped" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    throw new Error("Resend no esta configurado");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Citadely <${fromEmail}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      attachments: input.attachments,
    }),
  });

  const data = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;

  if (!response.ok) {
    throw new Error(data?.message ?? "Resend rechazo el envio");
  }

  return data;
}

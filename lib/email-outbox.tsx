import "server-only";

import { render } from "@react-email/render";
import { CitadelyEmail, type CitadelyEmailProps } from "@/emails/citadely-email";
import { formatCurrency } from "@/lib/citadely-db";
import { formatInTimeZone } from "@/lib/time";

// Lo encola apply_contribution_payment (20261024120100) cuando un aporte pasa a approved.
type ContributionPayload = {
  amount_cents: number;
  currency: string;
  business_name: string | null;
  contribution_id: string;
};

type AppointmentPayload = {
  appointmentId: string;
  status: string;
  startsAt: string;
  endsAt: string;
  updatedAt?: string;
  previousStartsAt?: string;
  previousEndsAt?: string;
  depositAmountCents: number;
  depositExpiresAt: string | null;
  depositConfirmedAt: string | null;
  cancellationReason: string | null;
  clientMessage: string | null;
  client: { name: string; email: string | null; phone: string | null };
  service: { name: string; description: string | null; durationMinutes: number; priceCents: number; depositType: string };
  business: {
    name: string;
    slug: string;
    timezone: string;
    currency: string;
    logoUrl: string | null;
    publicAddress: string | null;
    serviceMode: string;
    virtualPlatforms: string[];
    paymentAlias: string | null;
    paymentCbu: string | null;
    paymentInstructions: string | null;
    notificationEmail: string | null;
  };
};

export type EmailOutboxRow = {
  id: string;
  event_type:
    | "welcome"
    | "booking_created"
    | "deposit_confirmed"
    | "appointment_cancelled"
    | "appointment_rescheduled"
    | "appointment_reminder"
    | "contribution_received";
  recipient_kind: "user" | "client" | "owner";
  recipient_email: string;
  reply_to: string | null;
  idempotency_key: string;
  payload: Record<string, unknown>;
};

export type RenderedOutboxEmail = {
  subject: string;
  html: string;
  text: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
};

function formatDate(value: string, timezone: string | null | undefined) {
  return formatInTimeZone(value, timezone, {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

function formatUtcForIcs(value: string) {
  return new Date(value).toISOString().replaceAll("-", "").replaceAll(":", "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcs(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll(";", "\\;").replaceAll(",", "\\,").replaceAll(/\r?\n/g, "\\n");
}

function getAppointmentLocation(payload: AppointmentPayload) {
  if (payload.business.serviceMode === "virtual") {
    const platforms = payload.business.virtualPlatforms?.join(", ");
    return platforms ? `Modalidad virtual (${platforms})` : "Modalidad virtual";
  }
  if (payload.business.serviceMode === "hybrid") {
    return payload.business.publicAddress ? `Presencial en ${payload.business.publicAddress} o modalidad virtual` : "Presencial o modalidad virtual";
  }
  return payload.business.publicAddress ?? "Consultá la ubicación con el negocio";
}

function buildCalendar(payload: AppointmentPayload, eventType: EmailOutboxRow["event_type"]) {
  const cancelled = eventType === "appointment_cancelled";
  const updatedAtSequence = payload.updatedAt
    ? Math.floor(new Date(payload.updatedAt).getTime() / 1000)
    : 1;
  const sequence = eventType === "booking_created" ? 0 : Math.max(1, updatedAtSequence);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Citadely//Reservas//ES",
    "CALSCALE:GREGORIAN",
    `METHOD:${cancelled ? "CANCEL" : "REQUEST"}`,
    "BEGIN:VEVENT",
    `UID:citadely-${payload.appointmentId}@citadely.com.ar`,
    `DTSTAMP:${formatUtcForIcs(new Date().toISOString())}`,
    `DTSTART:${formatUtcForIcs(payload.startsAt)}`,
    `DTEND:${formatUtcForIcs(payload.endsAt)}`,
    `SEQUENCE:${sequence}`,
    `STATUS:${cancelled ? "CANCELLED" : "CONFIRMED"}`,
    `SUMMARY:${escapeIcs(`${payload.service.name} - ${payload.business.name}`)}`,
    `LOCATION:${escapeIcs(getAppointmentLocation(payload))}`,
    `DESCRIPTION:${escapeIcs(`Turno gestionado con Citadely. Estado: ${payload.status}.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return {
    filename: "turno-citadely.ics",
    content: Buffer.from(lines, "utf8").toString("base64"),
    contentType: "text/calendar; charset=utf-8",
  };
}

function bookingDetails(payload: AppointmentPayload) {
  return [
    { label: "Negocio", value: payload.business.name },
    { label: "Servicio", value: payload.service.name },
    { label: "Fecha y hora", value: formatDate(payload.startsAt, payload.business.timezone) },
    { label: "Duración", value: `${payload.service.durationMinutes} minutos` },
    { label: "Modalidad / ubicación", value: getAppointmentLocation(payload) },
    { label: "Valor del servicio", value: formatCurrency(payload.service.priceCents, payload.business.currency) },
  ];
}

function paymentNote(payload: AppointmentPayload) {
  const lines = [
    `Transferí ${formatCurrency(payload.depositAmountCents, payload.business.currency)} para confirmar la reserva.`,
    payload.depositExpiresAt ? `El plazo vence ${formatDate(payload.depositExpiresAt, payload.business.timezone)}.` : null,
    payload.business.paymentAlias ? `Alias: ${payload.business.paymentAlias}.` : null,
    payload.business.paymentCbu ? `CBU/CVU: ${payload.business.paymentCbu}.` : null,
    payload.business.paymentInstructions,
  ].filter(Boolean);
  return lines.join(" ");
}

function appointmentEmailContent(row: EmailOutboxRow, payload: AppointmentPayload): { props: CitadelyEmailProps; subject: string; calendar?: boolean } {
  const isOwner = row.recipient_kind === "owner";
  const details = bookingDetails(payload);
  const clientDetail = { label: "Cliente", value: `${payload.client.name}${payload.client.phone ? ` · ${payload.client.phone}` : ""}` };

  if (row.event_type === "booking_created") {
    const needsDeposit = payload.depositAmountCents > 0;
    return {
      subject: isOwner ? `Nueva reserva: ${payload.service.name}` : `${needsDeposit ? "Pre-reserva creada" : "Turno confirmado"}: ${payload.service.name}`,
      calendar: !isOwner && !needsDeposit,
      props: {
        brandAssetUrl: brandAssetUrl(),
        iconAssetUrl: emailIconUrl(needsDeposit ? "payment" : "calendar"),
        businessLogoUrl: payload.business.logoUrl,
        preview: isOwner ? `${payload.client.name} reservó ${payload.service.name}` : `Tu turno en ${payload.business.name}`,
        eyebrow: isOwner ? "Nueva reserva" : "Tu reserva",
        title: isOwner ? "Tenés un nuevo turno" : needsDeposit ? "Tu pre-reserva está creada" : "Tu turno está confirmado",
        intro: isOwner ? "Una persona reservó un servicio desde la agenda de Citadely." : `Hola ${payload.client.name}, guardamos tu turno con ${payload.business.name}.`,
        statusLabel: needsDeposit ? "Seña pendiente" : "Confirmado",
        statusTone: needsDeposit ? "warning" : "success",
        details: isOwner ? [clientDetail, ...details.slice(1)] : details,
        note: needsDeposit ? paymentNote(payload) : "Adjuntamos el turno para que puedas agregarlo a tu calendario.",
      },
    };
  }

  if (row.event_type === "deposit_confirmed") {
    const balance = Math.max(0, payload.service.priceCents - payload.depositAmountCents);
    return {
      subject: `Seña recibida: ${payload.service.name}`,
      calendar: true,
      props: {
        brandAssetUrl: brandAssetUrl(), businessLogoUrl: payload.business.logoUrl,
        iconAssetUrl: emailIconUrl("payment"),
        preview: `${payload.business.name} confirmó tu seña`, eyebrow: "Pago recibido",
        title: "Tu turno quedó confirmado", intro: `Hola ${payload.client.name}, ${payload.business.name} confirmó la recepción de tu seña.`,
        statusLabel: "Seña confirmada", statusTone: "success", details,
        note: balance > 0 ? `Saldo restante: ${formatCurrency(balance, payload.business.currency)}.` : "El servicio quedó abonado en su totalidad.",
      },
    };
  }

  if (row.event_type === "appointment_cancelled") {
    const reason = payload.cancellationReason || "El turno fue cancelado.";
    return {
      subject: `Turno cancelado: ${payload.service.name}`,
      calendar: !isOwner,
      props: {
        brandAssetUrl: brandAssetUrl(), businessLogoUrl: payload.business.logoUrl,
        iconAssetUrl: emailIconUrl("calendar"),
        preview: `Se canceló el turno de ${payload.service.name}`, eyebrow: "Actualización del turno",
        title: "El turno fue cancelado", intro: isOwner ? `Se canceló el turno de ${payload.client.name}.` : `Hola ${payload.client.name}, te avisamos que el turno ya no está activo.`,
        statusLabel: "Cancelado", statusTone: "danger", details: isOwner ? [clientDetail, ...details.slice(1)] : details,
        note: `Motivo: ${reason} Si corresponde una devolución, coordinála directamente con el negocio.`,
      },
    };
  }

  if (row.event_type === "appointment_rescheduled") {
    return {
      subject: `Turno reprogramado: ${payload.service.name}`,
      calendar: !isOwner,
      props: {
        brandAssetUrl: brandAssetUrl(), businessLogoUrl: payload.business.logoUrl,
        iconAssetUrl: emailIconUrl("calendar"),
        preview: `Nuevo horario para ${payload.service.name}`, eyebrow: "Cambio de horario",
        title: "El turno fue reprogramado", intro: isOwner ? `Cambió el horario del turno de ${payload.client.name}.` : `Hola ${payload.client.name}, tu turno tiene un nuevo horario.`,
        statusLabel: "Reprogramado", statusTone: "primary",
        details: [
          ...(isOwner ? [clientDetail] : []),
          ...(payload.previousStartsAt ? [{ label: "Horario anterior", value: formatDate(payload.previousStartsAt, payload.business.timezone) }] : []),
          { label: "Nuevo horario", value: formatDate(payload.startsAt, payload.business.timezone) },
          ...details.filter((detail) => !["Fecha y hora", "Negocio"].includes(detail.label)),
        ],
        note: "El archivo adjunto actualiza el mismo evento en tu calendario.",
      },
    };
  }

  return {
    subject: `Recordatorio: mañana tenés ${payload.service.name}`,
    props: {
      brandAssetUrl: brandAssetUrl(), businessLogoUrl: payload.business.logoUrl,
      iconAssetUrl: emailIconUrl("calendar"),
      preview: `Tu turno en ${payload.business.name} es en 24 horas`, eyebrow: "Recordatorio de turno",
      title: "Tu turno es mañana", intro: `Hola ${payload.client.name}, te recordamos tu próximo turno con ${payload.business.name}.`,
      statusLabel: "Confirmado", statusTone: "success", details,
      note: "Si necesitás hacer un cambio, respondé este email para comunicarte con el negocio.",
    },
  };
}

function appBaseUrl() {
  return (process.env.APP_BASE_URL || "https://www.citadely.com.ar").replace(/\/$/, "");
}

function brandAssetUrl() {
  return "https://www.citadely.com.ar/citadely-email-mark.png";
}

function emailIconUrl(icon: "calendar" | "payment" | "verification") {
  return `https://www.citadely.com.ar/email-icon-${icon}.png`;
}

export async function renderOutboxEmail(row: EmailOutboxRow): Promise<RenderedOutboxEmail> {
  if (row.event_type === "welcome") {
    const name = typeof row.payload.name === "string" ? row.payload.name : "";
    const props: CitadelyEmailProps = {
      brandAssetUrl: brandAssetUrl(), preview: "Tu espacio en Citadely está listo", eyebrow: "Bienvenida",
      iconAssetUrl: emailIconUrl("verification"),
      title: `Hola${name ? `, ${name}` : ""}`, intro: "Tu cuenta ya está verificada. Podés configurar tu negocio, publicar servicios y empezar a recibir reservas.",
      statusLabel: "Cuenta verificada", statusTone: "success",
      details: [
        { label: "1", value: "Completá los datos de tu negocio" },
        { label: "2", value: "Cargá tus servicios y horarios" },
        { label: "3", value: "Compartí tu página pública" },
      ],
      actionLabel: "Configurar mi negocio",
      actionUrl: `${appBaseUrl()}/onboarding`,
    };
    const element = <CitadelyEmail {...props} />;
    return { subject: "Bienvenido a Citadely", html: await render(element), text: await render(element, { plainText: true }) };
  }

  if (row.event_type === "contribution_received") {
    const payload = row.payload as unknown as ContributionPayload;
    const props: CitadelyEmailProps = {
      brandAssetUrl: brandAssetUrl(), iconAssetUrl: emailIconUrl("payment"),
      preview: "Recibimos tu aporte a Citadely", eyebrow: "Aporte recibido",
      title: "¡Gracias por tu aporte a Citadely!",
      intro: "Tu aporte voluntario ayuda a sostener el proyecto para todos los negocios que lo usan.",
      statusLabel: "Aporte aprobado", statusTone: "success",
      details: [
        { label: "Importe", value: formatCurrency(payload.amount_cents, payload.currency) },
        ...(payload.business_name ? [{ label: "Negocio", value: payload.business_name }] : []),
      ],
      note: "Citadely sigue siendo gratis: el aporte no cambia las funciones de tu cuenta. El comprobante del pago te lo envía Mercado Pago.",
      actionLabel: "Ir a mi panel",
      actionUrl: `${appBaseUrl()}/negocio/configuracion`,
    };
    const element = <CitadelyEmail {...props} />;
    return { subject: "¡Gracias por tu aporte a Citadely!", html: await render(element), text: await render(element, { plainText: true }) };
  }

  const payload = row.payload as unknown as AppointmentPayload;
  const content = appointmentEmailContent(row, payload);
  const element = <CitadelyEmail {...content.props} />;
  return {
    subject: content.subject,
    html: await render(element),
    text: await render(element, { plainText: true }),
    attachments: content.calendar ? [buildCalendar(payload, row.event_type)] : undefined,
  };
}

import { NextResponse } from "next/server";
import {
  buildClientBookingEmail,
  buildOwnerBookingEmail,
  sendResendEmail,
  type PublicBookingEmailContext,
} from "@/lib/booking-email";
import { type Business, type Service } from "@/lib/citadely-db";
import { insforgeAdmin, hasInsforgeAdminKey } from "@/lib/insforge-admin";

export const runtime = "nodejs";

type PublicBookingRequest = {
  businessId?: unknown;
  serviceId?: unknown;
  startsAt?: unknown;
  clientName?: unknown;
  clientEmail?: unknown;
  clientPhone?: unknown;
  clientMessage?: unknown;
};

type PublicBookingResult = {
  appointment_id?: string | null;
  client_id?: string | null;
  payment_id?: string | null;
  status?: string | null;
  amount_cents?: number | null;
  deposit_expires_at?: string | null;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

async function getOwnerEmail(businessId: string) {
  if (!hasInsforgeAdminKey || !insforgeAdmin) return null;

  const { data, error } = await insforgeAdmin.database
    .from("business_notification_settings")
    .select("email")
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    console.error("public booking owner email lookup failed", { businessId, message: error.message });
    return null;
  }

  return typeof data?.email === "string" ? data.email : null;
}

export async function POST(request: Request) {
  let payload: PublicBookingRequest;

  try {
    payload = (await request.json()) as PublicBookingRequest;
  } catch {
    return badRequest("El cuerpo de la solicitud no es valido.");
  }

  const businessId = readString(payload.businessId);
  const serviceId = readString(payload.serviceId);
  const startsAt = readString(payload.startsAt);
  const clientName = readString(payload.clientName);
  const clientEmail = readString(payload.clientEmail).toLowerCase();
  const clientPhone = readString(payload.clientPhone);
  const clientMessage = readString(payload.clientMessage);
  const startsAtDate = new Date(startsAt);

  if (!businessId || !serviceId || !startsAt || !clientName || !clientEmail || !clientPhone) {
    return badRequest("Completá nombre y apellido, email, teléfono, servicio y horario.");
  }

  if (!clientEmail.includes("@")) {
    return badRequest("Ingresá un email válido.");
  }

  if (Number.isNaN(startsAtDate.getTime())) {
    return badRequest("El horario seleccionado no es válido.");
  }

  if (!insforgeAdmin) {
    return NextResponse.json({ error: "InsForge admin no está configurado." }, { status: 500 });
  }

  const [businessResult, serviceResult] = await Promise.all([
    insforgeAdmin.database.from("businesses").select("*").eq("id", businessId).maybeSingle(),
    insforgeAdmin.database.from("services").select("*").eq("id", serviceId).eq("business_id", businessId).maybeSingle(),
  ]);

  if (businessResult.error || !businessResult.data) {
    return badRequest("Negocio no disponible para reservas.");
  }

  if (serviceResult.error || !serviceResult.data) {
    return badRequest("Servicio no disponible.");
  }

  const business = businessResult.data as Business;
  const service = serviceResult.data as Service;

  const { data: bookingData, error: bookingError } = await insforgeAdmin.database.rpc("create_public_booking", {
    p_business_id: business.id,
    p_service_id: service.id,
    p_starts_at: startsAtDate.toISOString(),
    p_client_name: clientName,
    p_client_email: clientEmail,
    p_client_phone: clientPhone,
    p_client_message: clientMessage,
  });

  if (bookingError) {
    return NextResponse.json({ error: bookingError.message }, { status: 409 });
  }

  const booking = (Array.isArray(bookingData) ? bookingData[0] : bookingData) as PublicBookingResult | undefined;

  if (!booking?.appointment_id) {
    return NextResponse.json({ error: "No se pudo crear la reserva." }, { status: 500 });
  }

  const endsAt = new Date(startsAtDate);
  endsAt.setMinutes(endsAt.getMinutes() + service.duration_minutes);

  const context: PublicBookingEmailContext = {
    appointmentId: booking.appointment_id,
    business,
    service,
    startsAt: startsAtDate.toISOString(),
    endsAt: endsAt.toISOString(),
    status: booking.status ?? "confirmed",
    amountCents: booking.amount_cents ?? 0,
    depositExpiresAt: booking.deposit_expires_at ?? null,
    clientName,
    clientEmail,
    clientPhone,
    clientMessage,
  };

  const ownerEmail = await getOwnerEmail(business.id);
  const clientEmailPayload = buildClientBookingEmail(context);
  const ownerEmailPayload = ownerEmail ? buildOwnerBookingEmail(context) : null;
  const emailResults = await Promise.allSettled([
    sendResendEmail({ to: clientEmail, ...clientEmailPayload }),
    ...(ownerEmailPayload && ownerEmail ? [sendResendEmail({ to: ownerEmail, ...ownerEmailPayload })] : []),
  ]);
  const failedEmails = emailResults.filter((result) => result.status === "rejected");

  if (!ownerEmail) {
    console.error("public booking owner email missing", { businessId: business.id, appointmentId: booking.appointment_id });
  }

  if (failedEmails.length > 0) {
    console.error("public booking email delivery failed", {
      appointmentId: booking.appointment_id,
      failedCount: failedEmails.length,
    });
  }

  return NextResponse.json({
    appointment_id: booking.appointment_id,
    client_id: booking.client_id,
    payment_id: booking.payment_id,
    status: booking.status,
    amount_cents: booking.amount_cents,
    deposit_expires_at: booking.deposit_expires_at,
    email_warning: failedEmails.length > 0 || !ownerEmail,
  });
}

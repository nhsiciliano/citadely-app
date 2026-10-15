import { NextResponse } from "next/server";
import { GENERIC_BOOKING_ERROR, getPublicBookingErrorMessage } from "@/lib/booking-errors";
import {
  ATTEMPT_REJECTIONS,
  BOOKING_LIMITS,
  getClientIp,
  hasEnoughPhoneDigits,
  hashIp,
  isEmail,
  isUuid,
  verifyTurnstileToken,
} from "@/lib/booking-protection";
import { revalidateTag } from "next/cache";
import { insforgeAdmin } from "@/lib/insforge-admin";
import { publicPageTag } from "@/lib/public-page-data";

export const runtime = "nodejs";

type PublicBookingRequest = {
  businessId?: unknown;
  serviceId?: unknown;
  startsAt?: unknown;
  clientName?: unknown;
  clientEmail?: unknown;
  clientPhone?: unknown;
  clientMessage?: unknown;
  turnstileToken?: unknown;
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

export async function POST(request: Request) {
  let payload: PublicBookingRequest;

  try {
    const raw = await request.text();
    if (raw.length > BOOKING_LIMITS.bodyBytes) return badRequest("La solicitud es demasiado grande.");
    payload = JSON.parse(raw) as PublicBookingRequest;
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

  if (!isUuid(businessId) || !isUuid(serviceId)) {
    return badRequest("Negocio o servicio no válido.");
  }

  if (clientName.length > BOOKING_LIMITS.name || clientPhone.length > BOOKING_LIMITS.phone || clientMessage.length > BOOKING_LIMITS.message) {
    return badRequest("Alguno de los datos es demasiado largo.");
  }

  if (clientEmail.length > BOOKING_LIMITS.email || !isEmail(clientEmail)) {
    return badRequest("Ingresá un email válido.");
  }

  if (!hasEnoughPhoneDigits(clientPhone)) {
    return badRequest("Ingresá un teléfono válido.");
  }

  if (Number.isNaN(startsAtDate.getTime())) {
    return badRequest("El horario seleccionado no es válido.");
  }

  if (!insforgeAdmin) {
    return NextResponse.json({ error: "InsForge admin no está configurado." }, { status: 500 });
  }

  const clientIp = getClientIp(request);
  if (!(await verifyTurnstileToken(readString(payload.turnstileToken), clientIp))) {
    return badRequest("No pudimos verificar que sos una persona. Recargá la página e intentá de nuevo.");
  }

  const [businessResult, serviceResult] = await Promise.all([
    insforgeAdmin.database.from("businesses").select("id,slug").eq("id", businessId).maybeSingle(),
    insforgeAdmin.database.from("services").select("id").eq("id", serviceId).eq("business_id", businessId).maybeSingle(),
  ]);

  if (businessResult.error || !businessResult.data) {
    return badRequest("Negocio no disponible para reservas.");
  }

  if (serviceResult.error || !serviceResult.data) {
    return badRequest("Servicio no disponible.");
  }

  const business = businessResult.data;
  const service = serviceResult.data;

  const { data: rejection, error: attemptError } = await insforgeAdmin.database.rpc("register_public_booking_attempt", {
    p_business_id: business.id,
    p_email: clientEmail,
    p_phone: clientPhone,
    p_ip_hash: hashIp(clientIp),
  });

  // Fail closed: without the limiter the endpoint would be an open relay for emails and held seats.
  if (attemptError) {
    console.error("public booking attempt check failed", { message: attemptError.message });
    return NextResponse.json({ error: GENERIC_BOOKING_ERROR }, { status: 503 });
  }

  if (rejection) {
    const message = ATTEMPT_REJECTIONS[String(rejection)] ?? ATTEMPT_REJECTIONS.ip;
    return NextResponse.json({ error: message }, { status: 429, headers: { "Retry-After": "600" } });
  }

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
    const knownMessage = getPublicBookingErrorMessage(bookingError.message);
    if (knownMessage) return NextResponse.json({ error: knownMessage }, { status: 409 });
    console.error("public booking rpc failed", { message: bookingError.message });
    return NextResponse.json({ error: GENERIC_BOOKING_ERROR }, { status: 500 });
  }

  const booking = (Array.isArray(bookingData) ? bookingData[0] : bookingData) as PublicBookingResult | undefined;

  if (!booking?.appointment_id) {
    return NextResponse.json({ error: "No se pudo crear la reserva." }, { status: 500 });
  }

  // The booked seat must show on the cached public page right away.
  revalidateTag(publicPageTag(business.slug), { expire: 0 });

  return NextResponse.json({
    appointment_id: booking.appointment_id,
    client_id: booking.client_id,
    payment_id: booking.payment_id,
    status: booking.status,
    amount_cents: booking.amount_cents,
    deposit_expires_at: booking.deposit_expires_at,
  });
}

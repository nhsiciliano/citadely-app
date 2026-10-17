import type { Appointment } from "@/lib/citadely-db";

export type AppointmentStatus = Appointment["status"];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending_payment: "Seña pendiente",
  confirmed: "Confirmado",
  cancelled: "Cancelado",
  completed: "Completado",
  no_show: "No asistió",
};

// Keep in sync with public.is_valid_appointment_transition (migration 20261015161037).
// A booking never goes back to pending_payment.
const NEXT_STATUSES: Record<AppointmentStatus, AppointmentStatus[]> = {
  pending_payment: ["confirmed", "cancelled"],
  confirmed: ["completed", "no_show", "cancelled"],
  completed: ["no_show", "confirmed"],
  no_show: ["completed", "confirmed"],
  cancelled: ["confirmed"],
};

export const CANCELLATION_REASON_MAX = 500;

/** Statuses that need an explicit confirmation before being applied. */
export function requiresStatusConfirmation(status: AppointmentStatus) {
  return status === "cancelled" || status === "no_show";
}

/** Statuses the dashboard may offer for this appointment, current one first. */
export function getStatusOptions(
  appointment: Pick<Appointment, "status" | "starts_at" | "deposit_amount_cents">,
  now = Date.now(),
): AppointmentStatus[] {
  const started = new Date(appointment.starts_at).getTime() <= now;
  const next = NEXT_STATUSES[appointment.status].filter((status) => {
    // La seña se confirma con "Confirmar seña recibida" (registra quién y cuándo).
    if (status === "confirmed" && appointment.status === "pending_payment" && appointment.deposit_amount_cents > 0) return false;
    if ((status === "completed" || status === "no_show") && !started) return false;
    return true;
  });
  return [appointment.status, ...next];
}

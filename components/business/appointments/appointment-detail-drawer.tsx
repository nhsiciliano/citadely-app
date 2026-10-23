"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, CreditCard, MessageSquare, UserRound } from "lucide-react";
import { FormMessage } from "@/components/ui";
import { formatAppointmentTime, formatCurrency, type Appointment } from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { Drawer, StatusBadge } from "../workspace-ui";
import { APPOINTMENT_STATUS_LABELS, CANCELLATION_REASON_MAX, getStatusOptions, requiresStatusConfirmation, type AppointmentStatus } from "@/lib/appointment-status";
import { useWorkspace } from "../workspace-context";
import { revalidatePublicPage } from "@/lib/revalidate-public-page";

const APPOINTMENT_SOURCE_LABELS: Record<Appointment["source"], string> = {
  business: "Cargado por el negocio",
  public_booking: "Reserva pública",
  client: "Cliente",
};

export function AppointmentDetailDrawer({ appointment, onClose }: { appointment: Appointment | null; onClose: () => void }) {
  const { business, refresh } = useWorkspace();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Cancelar y "No asistió" no se aplican al elegir la opción: piden confirmación (y motivo al cancelar).
  const [pendingChange, setPendingChange] = useState<{ appointmentId: string; status: AppointmentStatus } | null>(null);
  // La confirmación pertenece al turno que la originó: si se abre otro turno, desaparece.
  const pendingStatus = pendingChange && pendingChange.appointmentId === appointment?.id ? pendingChange.status : null;
  const [reason, setReason] = useState("");
  const [referenceTime] = useState(() => Date.now());

  async function applyStatus(status: AppointmentStatus, statusReason?: string) {
    if (!appointment) return;
    setPending(true);
    setMessage(null);
    const { error } = await insforge.database.rpc("update_appointment_status", {
      p_appointment_id: appointment.id,
      p_status: status,
      p_reason: statusReason ?? null,
    });
    setPending(false);
    if (error) {
      setMessage(getErrorMessage(error));
      return;
    }
    setPendingChange(null);
    setReason("");
    void revalidatePublicPage();
    await refresh();
  }

  function chooseStatus(status: AppointmentStatus) {
    if (!appointment || status === appointment.status) return;
    setMessage(null);
    if (requiresStatusConfirmation(status)) {
      setPendingChange({ appointmentId: appointment.id, status });
      return;
    }
    void applyStatus(status);
  }

  async function confirmDeposit() {
    if (!appointment) return;
    setPending(true);
    setMessage(null);
    const { error } = await insforge.database.rpc("confirm_appointment_deposit", { p_appointment_id: appointment.id });
    setPending(false);
    if (error) setMessage(getErrorMessage(error));
    else {
      void revalidatePublicPage();
      await refresh();
    }
  }

  return (
    <Drawer description={appointment ? formatAppointmentTime(appointment.starts_at, business.timezone) : undefined} onClose={onClose} open={Boolean(appointment)} title="Detalle del turno" width="medium">
      {appointment ? (
        <div className="grid gap-7">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-5">
            <StatusBadge status={appointment.status} />
            <span className="font-mono text-sm text-ink-soft">#{appointment.id.slice(0, 8).toUpperCase()}</span>
          </div>

          <dl className="grid gap-5 text-sm">
            <div className="grid grid-cols-[24px_1fr] gap-3">
              <UserRound aria-hidden="true" className="text-primary" size={19} />
              <div><dt className="text-ink-muted">Cliente</dt><dd className="mt-1 font-semibold">{appointment.clients?.name ?? "Cliente"}</dd><dd className="mt-1 text-ink-soft">{appointment.clients?.phone || appointment.clients?.email || "Sin contacto"}</dd></div>
            </div>
            <div className="grid grid-cols-[24px_1fr] gap-3">
              <CalendarClock aria-hidden="true" className="text-primary" size={19} />
              <div><dt className="text-ink-muted">Fecha y hora</dt><dd className="mt-1 font-semibold">{formatAppointmentTime(appointment.starts_at, business.timezone)}</dd></div>
            </div>
            <div className="grid grid-cols-[24px_1fr] gap-3">
              <Clock3 aria-hidden="true" className="text-primary" size={19} />
              <div><dt className="text-ink-muted">Servicio</dt><dd className="mt-1 font-semibold">{appointment.services?.name ?? "Servicio"}</dd><dd className="mt-1 text-ink-soft">{appointment.services?.duration_minutes ?? 30} minutos</dd></div>
            </div>
            <div className="grid grid-cols-[24px_1fr] gap-3">
              <CreditCard aria-hidden="true" className="text-primary" size={19} />
              <div><dt className="text-ink-muted">Seña</dt><dd className="mt-1 font-semibold">{appointment.deposit_amount_cents > 0 ? formatCurrency(appointment.deposit_amount_cents, business.currency) : "No requerida"}</dd></div>
            </div>
            <div className="grid grid-cols-[24px_1fr] gap-3">
              <MessageSquare aria-hidden="true" className="text-primary" size={19} />
              <div>
                <dt className="text-ink-muted">Origen</dt>
                <dd className="mt-1 font-semibold">{APPOINTMENT_SOURCE_LABELS[appointment.source] ?? "Desconocido"}</dd>
                <dt className="mt-3 text-ink-muted">Mensaje del cliente</dt>
                <dd className="mt-1 whitespace-pre-line text-ink-soft">{appointment.client_message?.trim() || "Sin mensaje."}</dd>
              </div>
            </div>
          </dl>

          <label className="form-label">
            Estado del turno
            <select className="form-control" disabled={pending} onChange={(event) => chooseStatus(event.target.value as AppointmentStatus)} value={appointment.status}>
              {getStatusOptions(appointment, referenceTime).map((status) => <option key={status} value={status}>{APPOINTMENT_STATUS_LABELS[status]}</option>)}
            </select>
          </label>

          {appointment.status === "cancelled" && appointment.cancellation_reason ? (
            <p className="text-sm text-ink-soft"><strong className="text-ink">Motivo de la cancelación:</strong> {appointment.cancellation_reason}</p>
          ) : null}

          {pendingStatus ? (
            <div className="grid gap-4 border border-danger-line bg-danger-soft p-4" role="group" aria-label="Confirmar cambio de estado">
              <p className="font-semibold">{pendingStatus === "cancelled" ? "¿Cancelar este turno?" : "¿Marcar que el cliente no asistió?"}</p>
              <p className="text-sm text-ink-soft">
                {pendingStatus === "cancelled"
                  ? "El horario se libera y el cliente recibe un email de cancelación."
                  : "Quedará registrado como inasistencia en el historial del cliente."}
              </p>
              {pendingStatus === "cancelled" ? (
                <label className="form-label">
                  Motivo (opcional)
                  <textarea className="form-control min-h-20" maxLength={CANCELLATION_REASON_MAX} onChange={(event) => setReason(event.target.value)} placeholder="Se incluye en el email al cliente" value={reason} />
                </label>
              ) : null}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button className="button-secondary" disabled={pending} onClick={() => { setPendingChange(null); setReason(""); }} type="button">Volver</button>
                <button className="button-primary" disabled={pending} onClick={() => void applyStatus(pendingStatus, reason)} type="button">{pendingStatus === "cancelled" ? "Sí, cancelar turno" : "Sí, marcar inasistencia"}</button>
              </div>
            </div>
          ) : null}

          {appointment.status === "pending_payment" && appointment.deposit_amount_cents > 0 ? (
            <button className="button-primary" disabled={pending} onClick={confirmDeposit} type="button"><CheckCircle2 aria-hidden="true" size={18} />Confirmar seña recibida</button>
          ) : null}
          {message ? <FormMessage type="error">{message}</FormMessage> : null}
        </div>
      ) : null}
    </Drawer>
  );
}

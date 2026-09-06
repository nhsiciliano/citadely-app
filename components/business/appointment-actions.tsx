"use client";

import { useState, type FormEvent } from "react";
import { CalendarClock, CheckCircle2, Clock3, CreditCard, UserRound } from "lucide-react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { formatAppointmentTime, formatCurrency, type Appointment } from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { Drawer, StatusBadge } from "./workspace-ui";
import { useWorkspace } from "./workspace-context";

export function NewAppointmentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { business, clients, services, refresh } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const service = services.find((item) => item.id === form.get("service_id"));
    const startsAt = new Date(String(form.get("starts_at")));
    const endsAt = new Date(startsAt.getTime() + (service?.duration_minutes ?? 30) * 60000);
    setPending(true);
    setMessage(null);

    const { error } = await insforge.database.from("appointments").insert([{
      business_id: business.id,
      client_id: String(form.get("client_id") ?? ""),
      service_id: String(form.get("service_id") ?? ""),
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: "confirmed",
      source: "business",
    }]);

    setPending(false);
    if (error) {
      setMessage(getErrorMessage(error));
      return;
    }

    formElement.reset();
    await refresh();
    onClose();
  }

  return (
    <Drawer description="Elegí un cliente, un servicio y el horario. El turno se guardará como confirmado." onClose={onClose} open={open} title="Nuevo turno">
      <form className="grid gap-5" onSubmit={addAppointment}>
        <label className="form-label">
          Cliente
          <select className="form-control" name="client_id" required>
            <option value="">Seleccionar cliente</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <label className="form-label">
          Servicio
          <select className="form-control" name="service_id" required>
            <option value="">Seleccionar servicio</option>
            {services.filter((service) => service.is_active).map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
          </select>
        </label>
        <Field label="Fecha y hora" name="starts_at" type="datetime-local" />
        {clients.length === 0 || services.filter((service) => service.is_active).length === 0 ? (
          <FormMessage type="error">Necesitás al menos un cliente y un servicio activo antes de crear el turno.</FormMessage>
        ) : null}
        {message ? <FormMessage type="error">{message}</FormMessage> : null}
        <div className="sticky bottom-0 -mx-5 mt-3 border-t border-[var(--color-line)] bg-white px-5 pt-5 sm:-mx-7 sm:px-7">
          <SubmitButton disabled={clients.length === 0 || services.filter((service) => service.is_active).length === 0} pending={pending}>Guardar turno</SubmitButton>
        </div>
      </form>
    </Drawer>
  );
}

export function AppointmentDetailDrawer({ appointment, onClose }: { appointment: Appointment | null; onClose: () => void }) {
  const { business, refresh } = useWorkspace();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function updateStatus(status: Appointment["status"]) {
    if (!appointment) return;
    setPending(true);
    setMessage(null);
    const { error } = await insforge.database.from("appointments").update({ status }).eq("id", appointment.id);
    setPending(false);
    if (error) setMessage(getErrorMessage(error));
    else await refresh();
  }

  async function confirmDeposit() {
    if (!appointment) return;
    setPending(true);
    setMessage(null);
    const { error } = await insforge.database.rpc("confirm_appointment_deposit", { p_appointment_id: appointment.id });
    setPending(false);
    if (error) setMessage(getErrorMessage(error));
    else await refresh();
  }

  return (
    <Drawer description={appointment ? formatAppointmentTime(appointment.starts_at) : undefined} onClose={onClose} open={Boolean(appointment)} title="Detalle del turno" width="medium">
      {appointment ? (
        <div className="grid gap-7">
          <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] pb-5">
            <StatusBadge status={appointment.status} />
            <span className="font-mono text-sm text-[var(--color-ink-soft)]">#{appointment.id.slice(0, 8).toUpperCase()}</span>
          </div>

          <dl className="grid gap-5 text-sm">
            <div className="grid grid-cols-[24px_1fr] gap-3">
              <UserRound aria-hidden="true" className="text-[var(--color-primary)]" size={19} />
              <div><dt className="text-[var(--color-ink-muted)]">Cliente</dt><dd className="mt-1 font-semibold">{appointment.clients?.name ?? "Cliente"}</dd><dd className="mt-1 text-[var(--color-ink-soft)]">{appointment.clients?.phone || appointment.clients?.email || "Sin contacto"}</dd></div>
            </div>
            <div className="grid grid-cols-[24px_1fr] gap-3">
              <CalendarClock aria-hidden="true" className="text-[var(--color-primary)]" size={19} />
              <div><dt className="text-[var(--color-ink-muted)]">Fecha y hora</dt><dd className="mt-1 font-semibold">{formatAppointmentTime(appointment.starts_at)}</dd></div>
            </div>
            <div className="grid grid-cols-[24px_1fr] gap-3">
              <Clock3 aria-hidden="true" className="text-[var(--color-primary)]" size={19} />
              <div><dt className="text-[var(--color-ink-muted)]">Servicio</dt><dd className="mt-1 font-semibold">{appointment.services?.name ?? "Servicio"}</dd><dd className="mt-1 text-[var(--color-ink-soft)]">{appointment.services?.duration_minutes ?? 30} minutos</dd></div>
            </div>
            <div className="grid grid-cols-[24px_1fr] gap-3">
              <CreditCard aria-hidden="true" className="text-[var(--color-primary)]" size={19} />
              <div><dt className="text-[var(--color-ink-muted)]">Seña</dt><dd className="mt-1 font-semibold">{appointment.deposit_amount_cents > 0 ? formatCurrency(appointment.deposit_amount_cents, business.currency) : "No requerida"}</dd></div>
            </div>
          </dl>

          <label className="form-label">
            Estado del turno
            <select className="form-control" disabled={pending} onChange={(event) => updateStatus(event.target.value as Appointment["status"])} value={appointment.status}>
              <option value="pending_payment">Seña pendiente</option>
              <option value="confirmed">Confirmado</option>
              <option value="cancelled">Cancelado</option>
              <option value="completed">Completado</option>
              <option value="no_show">No asistió</option>
            </select>
          </label>

          {appointment.status === "pending_payment" && appointment.deposit_amount_cents > 0 ? (
            <button className="button-primary" disabled={pending} onClick={confirmDeposit} type="button"><CheckCircle2 aria-hidden="true" size={18} />Confirmar seña recibida</button>
          ) : null}
          {message ? <FormMessage type="error">{message}</FormMessage> : null}
        </div>
      ) : null}
    </Drawer>
  );
}

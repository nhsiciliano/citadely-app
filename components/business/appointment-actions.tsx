"use client";

import { useMemo, useState, type FormEvent } from "react";
import { CalendarClock, CheckCircle2, Clock3, CreditCard, UserRound } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { buildBookingSlots, formatAppointmentTime, formatCurrency, getBookingAmountCents, type Appointment } from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { Drawer, StatusBadge } from "./workspace-ui";
import { useWorkspace } from "./workspace-context";

export function NewAppointmentDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { appointments, availabilitySlots, business, clients, services, refresh } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [startsAtValue, setStartsAtValue] = useState("");
  const [serviceId, setServiceId] = useState("");
  const activeServices = useMemo(() => services.filter((service) => service.is_active), [services]);
  const serviceOptions = useMemo(
    () => activeServices.map((service) => ({
      service,
      slots: buildBookingSlots(appointments, service, availabilitySlots).filter((slot) => slot.available),
    })).filter((option) => option.slots.length > 0),
    [activeServices, appointments, availabilitySlots],
  );
  const selectedOption = serviceOptions.find((option) => option.service.id === serviceId) ?? null;
  const groupedSlots = useMemo(() => {
    const groups = new Map<string, { label: string; slots: NonNullable<typeof selectedOption>["slots"] }>();
    for (const slot of selectedOption?.slots ?? []) {
      const current = groups.get(slot.dateKey);
      if (current) current.slots.push(slot);
      else groups.set(slot.dateKey, { label: `${slot.weekdayLabel} ${slot.dateLabel}`, slots: [slot] });
    }
    return Array.from(groups.entries());
  }, [selectedOption]);

  function closeDrawer() {
    if (pending) return;
    setStartsAtValue("");
    setServiceId("");
    setMessage(null);
    onClose();
  }

  function selectService(id: string) {
    setServiceId(id);
    setStartsAtValue("");
    setMessage(null);
  }

  async function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const service = selectedOption?.service;
    const slot = selectedOption?.slots.find((item) => item.startsAt === startsAtValue);
    if (!service || !slot) {
      setMessage("Elegí un servicio y uno de sus horarios disponibles.");
      return;
    }
    const startsAt = new Date(slot.startsAt);
    const endsAt = new Date(startsAt.getTime() + (service?.duration_minutes ?? 30) * 60000);
    const depositAmountCents = getBookingAmountCents(service);
    setPending(true);
    setMessage(null);

    const { error } = await insforge.database.from("appointments").insert([{
      business_id: business.id,
      client_id: String(form.get("client_id") ?? ""),
      service_id: service.id,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      status: depositAmountCents > 0 ? "pending_payment" : "confirmed",
      source: "business",
      deposit_amount_cents: depositAmountCents,
    }]);

    setPending(false);
    if (error) {
      setMessage(getErrorMessage(error));
      return;
    }

    formElement.reset();
    setStartsAtValue("");
    setServiceId("");
    await refresh();
    onClose();
  }

  return (
    <Drawer description="Elegí un cliente, un servicio disponible y uno de sus horarios publicados." onClose={closeDrawer} open={open} title="Nuevo turno">
      <form className="grid gap-5" onSubmit={addAppointment}>
        <label className="form-label">
          Cliente
          <select className="form-control" name="client_id" required>
            <option value="">Seleccionar cliente</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <fieldset className="grid gap-3">
          <legend className="form-label">Servicios disponibles</legend>
          {serviceOptions.length > 0 ? (
            <div className="divide-y divide-[var(--color-line)] border border-[var(--color-line)]">
              {serviceOptions.map(({ service, slots }) => (
                <button
                  aria-pressed={serviceId === service.id}
                  className={`flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${serviceId === service.id ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "bg-white hover:bg-[var(--color-surface-subtle)]"}`}
                  disabled={pending}
                  key={service.id}
                  onClick={() => selectService(service.id)}
                  type="button"
                >
                  <span className="min-w-0"><strong className="block truncate text-sm">{service.name}</strong><small className="mt-1 block font-mono text-xs">{service.duration_minutes} min</small></span>
                  <span className="status-badge status-confirmed">{slots.length} {slots.length === 1 ? "turno" : "turnos"}</span>
                </button>
              ))}
            </div>
          ) : <p className="border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] px-4 py-4 text-sm leading-6 text-[var(--color-ink-soft)]">No hay servicios con horarios disponibles.</p>}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="form-label">Fecha y hora</legend>
          {!selectedOption ? <p className="border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] px-4 py-4 text-sm leading-6 text-[var(--color-ink-soft)]">Seleccioná un servicio para ver sus horarios.</p> : null}
          {selectedOption ? (
            <div className="divide-y divide-[var(--color-line)] border border-[var(--color-line)]">
              {groupedSlots.map(([date, group]) => (
                <div className="grid gap-3 px-4 py-4" key={date}>
                  <p className="text-sm font-semibold capitalize text-[var(--color-ink)]">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.slots.map((slot) => (
                      <button aria-pressed={startsAtValue === slot.startsAt} className={`time-chip ${startsAtValue === slot.startsAt ? "!bg-[var(--color-primary)] !text-white" : ""}`} key={slot.startsAt} onClick={() => { setStartsAtValue(slot.startsAt); setMessage(null); }} type="button">{slot.timeLabel}</button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </fieldset>

        {clients.length === 0 || activeServices.length === 0 ? (
          <FormMessage type="error">Necesitás al menos un cliente y un servicio activo antes de crear el turno.</FormMessage>
        ) : null}
        {message ? <FormMessage type="error">{message}</FormMessage> : null}
        <div className="sticky bottom-0 -mx-5 mt-3 border-t border-[var(--color-line)] bg-white px-5 pt-5 sm:-mx-7 sm:px-7">
          <SubmitButton disabled={clients.length === 0 || serviceOptions.length === 0 || !startsAtValue} pending={pending}>Guardar turno</SubmitButton>
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

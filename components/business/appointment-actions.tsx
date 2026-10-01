"use client";

import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { CalendarClock, CheckCircle2, Clock3, CreditCard, Plus, Search, UserRound, X } from "lucide-react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { buildBookingSlots, formatAppointmentTime, formatCurrency, type Appointment, type Client } from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { Drawer, StatusBadge } from "./workspace-ui";
import { useWorkspace } from "./workspace-context";

export type SelectedAgendaSlot = { startsAt: string; serviceId?: string };

export function NewAppointmentDrawer({ open, onClose, initialSlot }: { open: boolean; onClose: () => void; initialSlot?: SelectedAgendaSlot | null }) {
  const { appointments, availabilitySlots, business, clients, services, refresh } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const clientTriggerRef = useRef<HTMLButtonElement>(null);
  const [startsAtValue, setStartsAtValue] = useState(initialSlot?.startsAt ?? "");
  const [serviceId, setServiceId] = useState(initialSlot?.serviceId ?? "");
  const activeServices = useMemo(() => services.filter((service) => service.is_active), [services]);
  const serviceOptions = useMemo(
    () => activeServices.map((service) => ({
      service,
      slots: buildBookingSlots(
        appointments,
        service,
        initialSlot ? availabilitySlots.filter((slot) => new Date(slot.starts_at).getTime() === new Date(initialSlot.startsAt).getTime() && slot.service_id === service.id) : availabilitySlots,
      ).filter((slot) => slot.available),
    })).filter((option) => initialSlot
      ? option.slots.some((slot) => slot.startsAt === initialSlot.startsAt)
      : option.slots.length > 0),
    [activeServices, appointments, availabilitySlots, initialSlot],
  );
  const resolvedServiceId = serviceId || (initialSlot && serviceOptions.length === 1 ? serviceOptions[0].service.id : "");
  const selectedOption = serviceOptions.find((option) => option.service.id === resolvedServiceId) ?? null;
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
    setClientPickerOpen(false);
    setSelectedClient(null);
    setStartsAtValue("");
    setServiceId("");
    setMessage(null);
    onClose();
  }

  function closeClientPicker() {
    setClientPickerOpen(false);
  }

  function chooseClient(client: Client) {
    setSelectedClient(client);
    setMessage(null);
    closeClientPicker();
  }

  function selectService(id: string) {
    setServiceId(id);
    setStartsAtValue(initialSlot?.startsAt ?? "");
    setMessage(null);
  }

  async function addAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const service = selectedOption?.service;
    const slot = selectedOption?.slots.find((item) => item.startsAt === startsAtValue);
    if (!selectedClient) {
      setMessage("Seleccioná un cliente antes de guardar el turno.");
      clientTriggerRef.current?.focus();
      return;
    }
    if (!service || !slot) {
      setMessage("Elegí un servicio y uno de sus horarios disponibles.");
      return;
    }
    setPending(true);
    setMessage(null);

    const { error } = await insforge.database.rpc("create_manual_appointment", {
      p_business_id: business.id,
      p_client_id: selectedClient.id,
      p_service_id: service.id,
      p_starts_at: slot.startsAt,
    });

    setPending(false);
    if (error) {
      const errorMessage = getErrorMessage(error);
      if (/ocupado|disponible|habilitado/i.test(errorMessage)) {
        await refresh();
        setMessage("El horario ya no está disponible. Elegí otro turno libre.");
      } else setMessage(errorMessage);
      return;
    }

    formElement.reset();
    setStartsAtValue("");
    setServiceId("");
    setSelectedClient(null);
    await refresh();
    onClose();
  }

  return (
    <>
    <Drawer description={initialSlot ? "Asigná este horario libre a un cliente." : "Elegí un cliente, un servicio disponible y uno de sus horarios publicados."} onClose={closeDrawer} open={open} title="Nuevo turno">
      <form className="grid gap-5" onSubmit={addAppointment}>
        <div className="grid gap-2">
          <span className="form-label">Cliente</span>
          <button aria-haspopup="dialog" className="form-control flex items-center justify-between gap-3 text-left" disabled={pending} onClick={() => setClientPickerOpen(true)} ref={clientTriggerRef} type="button">
            <span className="min-w-0 truncate font-medium">{selectedClient?.name ?? "Seleccionar cliente"}</span>
            <UserRound aria-hidden="true" className="shrink-0 text-[var(--color-primary)]" size={18} />
          </button>
          {selectedClient ? <p className="truncate text-xs text-[var(--color-ink-soft)]">{[selectedClient.email, selectedClient.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p> : null}
        </div>
        <fieldset className="grid gap-3">
          <legend className="form-label">Servicios disponibles</legend>
          {serviceOptions.length > 0 ? (
            <div className="divide-y divide-[var(--color-line)] border border-[var(--color-line)]">
              {serviceOptions.map(({ service, slots }) => (
                <button
                  aria-pressed={resolvedServiceId === service.id}
                  className={`flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${resolvedServiceId === service.id ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "bg-white hover:bg-[var(--color-surface-subtle)]"}`}
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
          ) : <p className="border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] px-4 py-4 text-sm leading-6 text-[var(--color-ink-soft)]">{initialSlot ? "Este horario ya no está disponible para ningún servicio." : "No hay servicios con horarios disponibles."}</p>}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="form-label">Fecha y hora</legend>
          {initialSlot ? <p className="border border-[var(--color-line)] bg-[var(--color-surface-subtle)] px-4 py-4 font-mono text-sm font-semibold text-[var(--color-ink)]">{formatAppointmentTime(initialSlot.startsAt)}</p> : null}
          {!initialSlot && !selectedOption ? <p className="border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] px-4 py-4 text-sm leading-6 text-[var(--color-ink-soft)]">Seleccioná un servicio para ver sus horarios.</p> : null}
          {!initialSlot && selectedOption ? (
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

        {activeServices.length === 0 ? (
          <FormMessage type="error">Necesitás un servicio activo con horarios disponibles antes de crear el turno.</FormMessage>
        ) : null}
        {message ? <FormMessage type="error">{message}</FormMessage> : null}
        <div className="sticky bottom-0 -mx-5 mt-3 border-t border-[var(--color-line)] bg-white px-5 pt-5 sm:-mx-7 sm:px-7">
          <SubmitButton disabled={!selectedClient || serviceOptions.length === 0 || !startsAtValue} pending={pending}>Guardar turno</SubmitButton>
        </div>
      </form>
    </Drawer>
    <ClientPickerDialog clients={clients} onClose={closeClientPicker} onClosed={() => clientTriggerRef.current?.focus()} onSelect={chooseClient} open={open && clientPickerOpen} />
    </>
  );
}

function ClientPickerDialog({ clients, onClose, onClosed, onSelect, open }: { clients: Client[]; onClose: () => void; onClosed: () => void; onSelect: (client: Client) => void; open: boolean }) {
  const { business, refresh } = useWorkspace();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const filteredClients = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    if (!normalized) return clients;
    return clients.filter((client) => [client.name, client.email, client.phone].some((value) => value?.toLocaleLowerCase("es").includes(normalized)));
  }, [clients, query]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      searchRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function close() {
    if (pending) return;
    setCreating(false);
    setQuery("");
    setMessage(null);
    onClose();
  }

  function select(client: Client) {
    setQuery("");
    onSelect(client);
  }

  async function addClient(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("client_name") ?? "").trim();
    if (!name) {
      setMessage("Ingresá el nombre y apellido del cliente.");
      return;
    }
    setPending(true);
    setMessage(null);
    const { data: created, error } = await insforge.database.from("clients").insert([{
      business_id: business.id,
      name,
      email: String(form.get("client_email") ?? "").trim(),
      phone: String(form.get("client_phone") ?? "").trim(),
    }]).select("id,business_id,user_id,name,email,phone,notes_summary").single();
    setPending(false);
    if (error || !created) {
      setMessage(error ? getErrorMessage(error) : "No pudimos crear el cliente. Intentá nuevamente.");
      return;
    }
    onSelect(created as Client);
    setCreating(false);
    setQuery("");
    void refresh();
  }

  return (
    <dialog
      aria-labelledby={titleId}
      className="client-picker-dialog m-auto max-h-[min(85dvh,760px)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto border border-[var(--color-line)] bg-white p-0 text-[var(--color-ink)] shadow-[var(--shadow-raised)] backdrop:bg-[rgba(4,20,42,.48)]"
      onCancel={(event) => { event.preventDefault(); close(); }}
      onClose={onClosed}
      ref={dialogRef}
      style={{ animation: "none" }}
    >
      <div className="flex items-start justify-between gap-4 border-b border-[var(--color-line)] px-5 py-5 sm:px-7">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.025em]" id={titleId}>{creating ? "Nuevo cliente" : "Seleccionar cliente"}</h2>
          <p className="mt-1 text-sm text-[var(--color-ink-soft)]">{creating ? "Guardá la ficha para continuar con el turno." : "Buscá por nombre, email o teléfono."}</p>
        </div>
        <button aria-label="Cerrar selector de clientes" className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-[var(--color-line)]" disabled={pending} onClick={close} type="button"><X aria-hidden="true" size={19} /></button>
      </div>
      {creating ? (
        <form className="grid gap-5 px-5 py-6 sm:px-7" onSubmit={addClient}>
          <Field label="Nombre" name="client_name" placeholder="Nombre y apellido" />
          <Field autoComplete="email" label="Email" name="client_email" placeholder="cliente@ejemplo.com" required={false} type="email" />
          <Field autoComplete="tel" label="Teléfono" name="client_phone" placeholder="11 2345 6789" required={false} />
          {message ? <FormMessage type="error">{message}</FormMessage> : null}
          <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-line)] pt-5 sm:flex-row sm:justify-end">
            <button className="button-secondary" disabled={pending} onClick={() => { setCreating(false); setMessage(null); }} type="button">Volver a la lista</button>
            <div className="sm:w-48"><SubmitButton pending={pending}>Guardar cliente</SubmitButton></div>
          </div>
        </form>
      ) : (
        <div className="grid gap-5 px-5 py-6 sm:px-7">
          <label className="flex min-h-12 items-center gap-3 rounded-md border border-[var(--color-line)] px-4 focus-within:border-[var(--color-primary)] focus-within:shadow-[0_0_0_3px_rgba(9,87,217,0.1)]">
            <span className="sr-only">Buscar clientes</span>
            <Search aria-hidden="true" className="shrink-0 text-[var(--color-ink-muted)]" size={18} />
            <input className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--color-ink-muted)] focus-visible:outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Nombre, email o teléfono" ref={searchRef} type="search" value={query} />
          </label>
          {filteredClients.length > 0 ? (
            <div className="max-h-[48dvh] overflow-auto border border-[var(--color-line)]">
              <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                <thead className="sticky top-0 bg-[var(--color-surface-subtle)] text-xs font-semibold text-[var(--color-ink-soft)]"><tr><th className="px-4 py-3" scope="col">Nombre y apellido</th><th className="px-4 py-3" scope="col">Email</th><th className="px-4 py-3" scope="col">Teléfono</th></tr></thead>
                <tbody className="divide-y divide-[var(--color-line)]">
                  {filteredClients.map((client) => <tr className="cursor-pointer hover:bg-[var(--color-primary-soft)]" key={client.id} onClick={() => select(client)}><td className="px-4 py-3"><button className="font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline" type="button">{client.name}</button></td><td className="px-4 py-3 text-[var(--color-ink-soft)]">{client.email || "Sin email"}</td><td className="px-4 py-3 text-[var(--color-ink-soft)]">{client.phone || "Sin teléfono"}</td></tr>)}
                </tbody>
              </table>
            </div>
          ) : <div className="border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] px-5 py-8 text-center"><p className="font-semibold">{query ? "No encontramos coincidencias" : "Todavía no hay clientes"}</p><p className="mt-2 text-sm text-[var(--color-ink-soft)]">{query ? "Probá con otra búsqueda o creá un cliente." : "Creá el primer cliente para asignarle un turno."}</p></div>}
          {filteredClients.length > 0 ? <p className="text-xs text-[var(--color-ink-muted)] sm:hidden">Deslizá la tabla para ver todos los datos de contacto.</p> : null}
          <button className="button-secondary w-full sm:w-fit" onClick={() => { setCreating(true); setMessage(null); }} type="button"><Plus aria-hidden="true" size={18} />Crear nuevo cliente</button>
        </div>
      )}
    </dialog>
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
              {appointment.status === "pending_payment" && appointment.deposit_amount_cents > 0 ? null : (
                <option value="confirmed">Confirmado</option>
              )}
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

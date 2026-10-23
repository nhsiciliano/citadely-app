"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { UserRound } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { buildBookingSlots, formatAppointmentTime, type Client } from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { Drawer } from "../workspace-ui";
import { useWorkspace } from "../workspace-context";
import { revalidatePublicPage } from "@/lib/revalidate-public-page";
import { ClientPickerDialog } from "./client-picker-dialog";

export type SelectedAgendaSlot = { startsAt: string; serviceId?: string };

export function NewAppointmentDrawer({ open, onClose, initialSlot }: { open: boolean; onClose: () => void; initialSlot?: SelectedAgendaSlot | null }) {
  const { appointments, availabilitySlots, business, services, refresh } = useWorkspace();
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
        business.timezone,
      ).filter((slot) => slot.available),
    })).filter((option) => initialSlot
      ? option.slots.some((slot) => slot.startsAt === initialSlot.startsAt)
      : option.slots.length > 0),
    [activeServices, appointments, availabilitySlots, business.timezone, initialSlot],
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
    if (slot.capacity > 1 && !selectedClient.email?.trim()) {
      setMessage("Este horario tiene cupos para varias personas. Agregá un email al cliente para poder asignarle una plaza.");
      clientTriggerRef.current?.focus();
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
      if (/ocupado|disponible|habilitado|cupos|superpone/i.test(errorMessage)) {
        await refresh();
        setMessage("El horario ya no está disponible. Elegí otro turno libre.");
      } else setMessage(errorMessage);
      return;
    }

    formElement.reset();
    setStartsAtValue("");
    setServiceId("");
    setSelectedClient(null);
    void revalidatePublicPage();
    await refresh();
    onClose();
  }

  return (
    <>
    <Drawer description={initialSlot ? "Asigná este horario libre a un cliente." : "Elegí un cliente, un servicio disponible y uno de sus horarios publicados."} onClose={closeDrawer} open={open} title="Nuevo turno">
      <form method="post" className="grid gap-5" onSubmit={addAppointment}>
        <div className="grid gap-2">
          <span className="form-label">Cliente</span>
          <button aria-haspopup="dialog" className="form-control flex items-center justify-between gap-3 text-left" disabled={pending} onClick={() => setClientPickerOpen(true)} ref={clientTriggerRef} type="button">
            <span className="min-w-0 truncate font-medium">{selectedClient?.name ?? "Seleccionar cliente"}</span>
            <UserRound aria-hidden="true" className="shrink-0 text-primary" size={18} />
          </button>
          {selectedClient ? <p className="truncate text-xs text-ink-soft">{[selectedClient.email, selectedClient.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p> : null}
        </div>
        <fieldset className="grid gap-3">
          <legend className="form-label">Servicios disponibles</legend>
          {serviceOptions.length > 0 ? (
            <div className="divide-y divide-line border border-line">
              {serviceOptions.map(({ service, slots }) => (
                <button
                  aria-pressed={resolvedServiceId === service.id}
                  className={`flex min-h-14 w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors ${resolvedServiceId === service.id ? "bg-primary-soft text-primary" : "bg-white hover:bg-surface-subtle"}`}
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
          ) : <p className="border border-dashed border-line-strong bg-surface-subtle px-4 py-4 text-sm leading-6 text-ink-soft">{initialSlot ? "Este horario ya no está disponible para ningún servicio." : "No hay servicios con horarios disponibles."}</p>}
        </fieldset>

        <fieldset className="grid gap-3">
          <legend className="form-label">Fecha y hora</legend>
          {initialSlot ? <p className="border border-line bg-surface-subtle px-4 py-4 font-mono text-sm font-semibold text-ink">{formatAppointmentTime(initialSlot.startsAt, business.timezone)}</p> : null}
          {!initialSlot && !selectedOption ? <p className="border border-dashed border-line-strong bg-surface-subtle px-4 py-4 text-sm leading-6 text-ink-soft">Seleccioná un servicio para ver sus horarios.</p> : null}
          {!initialSlot && selectedOption ? (
            <div className="divide-y divide-line border border-line">
              {groupedSlots.map(([date, group]) => (
                <div className="grid gap-3 px-4 py-4" key={date}>
                  <p className="text-sm font-semibold capitalize text-ink">{group.label}</p>
                  <div className="flex flex-wrap gap-2">
                    {group.slots.map((slot) => (
                      <button aria-pressed={startsAtValue === slot.startsAt} className={`time-chip ${startsAtValue === slot.startsAt ? "!bg-primary !text-white" : ""}`} key={slot.startsAt} onClick={() => { setStartsAtValue(slot.startsAt); setMessage(null); }} type="button">{slot.timeLabel} · {slot.remaining} de {slot.capacity} libres</button>
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
        <div className="sticky bottom-0 -mx-5 mt-3 border-t border-line bg-white px-5 pt-5 sm:-mx-7 sm:px-7">
          <SubmitButton disabled={!selectedClient || serviceOptions.length === 0 || !startsAtValue} pending={pending}>Guardar turno</SubmitButton>
        </div>
      </form>
    </Drawer>
    <ClientPickerDialog onClose={closeClientPicker} onClosed={() => clientTriggerRef.current?.focus()} onSelect={chooseClient} open={open && clientPickerOpen} />
    </>
  );
}

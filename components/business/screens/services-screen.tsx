"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Clock3, Pencil, Plus, Power } from "lucide-react";
import { FormMessage, SubmitButton } from "@/components/ui";
import { formatCurrency, getSlotOccupancy, type Service } from "@/lib/citadely-db";
import { READ_ONLY_HINT } from "@/lib/business-access";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { revalidatePublicPage } from "@/lib/revalidate-public-page";
import {
  buildDateTimes,
  getEditableWindow,
  monthOptions,
  requestedSlots,
  slotCount,
  validateSlots,
  type DateTimes,
} from "@/lib/service-availability";
import { readServiceForm, upsertServiceWithSlots } from "@/lib/service-form";
import { formatDateKey, toMonthKey } from "@/lib/time";
import { AvailabilityEditor } from "../services/availability-editor";
import { ServiceFormFields } from "../services/service-form-fields";
import { useWorkspace } from "../workspace-context";
import { Drawer, EmptyState, PageHeader } from "../workspace-ui";

export function ServicesScreen() {
  const { access: subscription, appointments, availabilitySlots, business, refresh, services } = useWorkspace();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timeZone = business.timezone;
  const options = useMemo(() => monthOptions(timeZone), [timeZone]);
  const [selectedMonth, setSelectedMonth] = useState(options[0]?.key ?? toMonthKey(new Date(), timeZone));
  const selectedMonthLabel = formatDateKey(`${selectedMonth}-01`, { month: "long", year: "numeric" });
  // Se incrementa al abrir el drawer: reinicia el día y la hora en edición del editor de disponibilidad.
  const [editorSession, setEditorSession] = useState(0);
  const [dateTimes, setDateTimes] = useState<DateTimes>({});

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (new URLSearchParams(window.location.search).get("nuevo") === "1") {
        setEditingService(null);
        setDateTimes({});
        setEditorSession((count) => count + 1);
        setMessage(null);
        setDrawerOpen(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function openNewService() {
    setEditingService(null);
    setDateTimes({});
    setEditorSession((count) => count + 1);
    setMessage(null);
    setDrawerOpen(true);
  }

  function openEditService(service: Service) {
    setEditingService(service);
    setDateTimes(buildDateTimes(availabilitySlots, service.id, options, timeZone));
    setEditorSession((count) => count + 1);
    setMessage(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (pending) return;
    setDrawerOpen(false);
  }

  const editableWindow = getEditableWindow(options, timeZone);

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscription.hasDashboardAccess) return;
    const formElement = event.currentTarget;

    const parsed = readServiceForm(new FormData(formElement));
    if (parsed.input === null) { setMessage(parsed.error); return; }
    const slots = requestedSlots(dateTimes, timeZone);
    const slotError = validateSlots(slots);
    if (slotError) { setMessage(slotError); return; }

    if (editingService) {
      // Adelanto del chequeo de reservas vigentes; la base de datos lo vuelve a verificar de forma atómica.
      const desiredByStart = new Map(slots.map((slot) => [slot.startsAt.toISOString(), slot]));
      const duration = parsed.input.durationMinutes;
      for (const slot of availabilitySlots.filter((item) => item.service_id === editingService.id)) {
        const occupancy = getSlotOccupancy(slot, appointments);
        if (!occupancy.booked) continue;
        const desired = desiredByStart.get(new Date(slot.starts_at).toISOString());
        const desiredEnd = desired ? new Date(desired.startsAt.getTime() + duration * 60000).toISOString() : null;
        if ((!desired && slot.is_active) || (desired && (desired.capacity < occupancy.booked || desiredEnd !== new Date(slot.ends_at).toISOString()))) {
          setMessage("Hay reservas vigentes en uno de esos horarios. Conservá el horario y un cupo suficiente para ellas.");
          return;
        }
      }
    }

    setPending(true);
    setMessage(null);
    const { error } = await upsertServiceWithSlots({
      businessId: business.id,
      serviceId: editingService?.id ?? null,
      input: parsed.input,
      slots,
      windowStart: editableWindow.start,
      windowEnd: editableWindow.end,
    });
    setPending(false);

    if (error) {
      setMessage(getErrorMessage(error) || "No se pudo guardar el servicio.");
      return;
    }

    formElement.reset();
    setDateTimes({});
    void revalidatePublicPage();
    await refresh();
    setDrawerOpen(false);
    setEditingService(null);
  }

  async function toggleService(service: Service) {
    if (!subscription.hasDashboardAccess) return;
    setPending(true);
    const { error } = await insforge.database.from("services").update({ is_active: !service.is_active }).eq("id", service.id);
    setPending(false);
    if (error) setMessage(getErrorMessage(error));
    else {
      void revalidatePublicPage();
      await refresh();
    }
  }

  return (
    <>
      <PageHeader actions={<button className="button-primary" disabled={!subscription.hasDashboardAccess} onClick={openNewService} title={subscription.hasDashboardAccess ? undefined : READ_ONLY_HINT} type="button"><Plus aria-hidden="true" size={18} />Nuevo servicio</button>} description="Revisá estado, duración, precio, seña y disponibilidad sin abrir cada servicio." title="Servicios" />

      <div className="grid gap-5 px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
        {!subscription.hasDashboardAccess ? <FormMessage type="error">{READ_ONLY_HINT}</FormMessage> : null}
        {message ? <FormMessage type="error">{message}</FormMessage> : null}
        <section className="overflow-hidden border border-line bg-white shadow-surface">
          {services.length === 0 ? <div className="p-6"><EmptyState action={<button className="button-primary" disabled={!subscription.hasDashboardAccess} onClick={openNewService} title={subscription.hasDashboardAccess ? undefined : READ_ONLY_HINT} type="button"><Plus aria-hidden="true" size={17} />Crear servicio</button>} text="Definí nombre, duración, precio, seña y los primeros horarios disponibles." title="Todavía no hay servicios" /></div> : (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[980px]">
                <thead><tr><th>Servicio</th><th>Estado</th><th>Duración</th><th>Precio</th><th>Seña</th><th>Disponibilidad</th><th><span className="sr-only">Acciones</span></th></tr></thead>
                <tbody>
                  {services.map((service) => (
                    <tr key={service.id}>
                      <td><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-md bg-primary-soft font-semibold text-primary">{service.name.slice(0, 1).toUpperCase()}</span><span><strong>{service.name}</strong><small>{service.description || "Sin descripción"}</small></span></div></td>
                      <td><span className={service.is_active ? "status-badge status-confirmed" : "status-badge status-cancelled"}>{service.is_active ? "Activo" : "Pausado"}</span></td>
                      <td><span className="inline-flex items-center gap-2"><Clock3 aria-hidden="true" size={16} />{service.duration_minutes} min</span></td>
                      <td className="font-mono font-semibold">{formatCurrency(service.price_cents, business.currency)}</td>
                      <td>{service.deposit_type === "free" ? "Sin seña" : service.deposit_type === "full" ? "100%" : formatCurrency(service.deposit_value_cents, business.currency)}</td>
                      <td><span className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" size={16} />{slotCount(availabilitySlots, service.id, selectedMonth, timeZone)} horarios en {selectedMonthLabel}</span></td>
                      <td><div className="flex justify-end gap-2"><button aria-label={`Editar ${service.name}`} className="button-secondary" disabled={pending || !subscription.hasDashboardAccess} onClick={() => openEditService(service)} title={subscription.hasDashboardAccess ? undefined : READ_ONLY_HINT} type="button"><Pencil aria-hidden="true" size={16} />Editar</button><button aria-label={`${service.is_active ? "Pausar" : "Activar"} ${service.name}`} className="button-secondary" disabled={pending || !subscription.hasDashboardAccess} onClick={() => toggleService(service)} title={subscription.hasDashboardAccess ? undefined : READ_ONLY_HINT} type="button"><Power aria-hidden="true" size={16} />{service.is_active ? "Pausar" : "Activar"}</button></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <Drawer description={editingService ? "Actualizá los datos y la disponibilidad de los próximos seis meses." : "Completá los datos y publicá al menos un horario mensual."} onClose={closeDrawer} open={drawerOpen} title={editingService ? "Editar servicio" : "Nuevo servicio"}>
        <form method="post" className="grid gap-6" key={editingService?.id ?? "new-service"} onSubmit={saveService}>
          <ServiceFormFields editingService={editingService} />
          <AvailabilityEditor
            appointments={appointments}
            availabilitySlots={availabilitySlots}
            dateTimes={dateTimes}
            editingServiceId={editingService?.id ?? null}
            key={editorSession}
            onChange={setDateTimes}
            onError={setMessage}
            onMonthChange={setSelectedMonth}
            options={options}
            selectedMonth={selectedMonth}
            timeZone={timeZone}
          />
          {message ? <FormMessage type="error">{message}</FormMessage> : null}
          <div className="sticky bottom-0 -mx-5 border-t border-line bg-white px-5 pt-5 sm:-mx-7 sm:px-7"><SubmitButton disabled={!subscription.hasDashboardAccess} pending={pending}>{editingService ? "Guardar cambios" : "Guardar servicio"}</SubmitButton></div>
        </form>
      </Drawer>
    </>
  );
}

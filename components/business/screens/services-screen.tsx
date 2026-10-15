"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, Check, Clock3, Pencil, Plus, Power, Tag } from "lucide-react";
import { Field, FormMessage, SubmitButton } from "@/components/ui";
import { formatCurrency, getSlotOccupancy, type Service, type ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { READ_ONLY_HINT } from "@/lib/business-access";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { readServiceForm, SERVICE_LIMITS, upsertServiceWithSlots } from "@/lib/service-form";
import { addMonthsToMonthKey, formatDateKey, getDaysInMonth, getWeekdayOfDateKey, toDateKey, toMonthKey, toTimeKey, zonedTimeToUtc } from "@/lib/time";
import { useWorkspace } from "../workspace-context";
import { Drawer, EmptyState, PageHeader } from "../workspace-ui";
import { revalidatePublicPage } from "@/lib/revalidate-public-page";

function monthDays(value: string) {
  const leading = (getWeekdayOfDateKey(`${value}-01`) + 6) % 7;
  return [
    ...Array.from({ length: leading }, (_, index) => ({ blank: true as const, key: `blank-${index}` })),
    ...Array.from({ length: getDaysInMonth(value) }, (_, index) => {
      const key = `${value}-${String(index + 1).padStart(2, "0")}`;
      return { blank: false as const, key, day: index + 1, weekday: formatDateKey(key, { weekday: "short" }) };
    }),
  ];
}

function monthOptions(timeZone: string) {
  const currentMonth = toMonthKey(new Date(), timeZone);
  return Array.from({ length: 6 }, (_, index) => {
    const key = addMonthsToMonthKey(currentMonth, index);
    return { key, label: formatDateKey(`${key}-01`, { month: "long", year: "numeric" }) };
  });
}

function slotCount(slots: ServiceAvailabilitySlot[], serviceId: string, value: string, timeZone: string) {
  return slots.filter((slot) => slot.service_id === serviceId && slot.is_active && toMonthKey(slot.starts_at, timeZone) === value).length;
}

function currencyInputValue(cents: number) {
  return String(cents / 100);
}

export function ServicesScreen() {
  const { access: subscription, appointments, availabilitySlots, business, refresh, services } = useWorkspace();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timeZone = business.timezone;
  const options = useMemo(() => monthOptions(timeZone), [timeZone]);
  const [selectedMonth, setSelectedMonth] = useState(options[0]?.key ?? toMonthKey(new Date(), timeZone));
  const [selectedDate, setSelectedDate] = useState("");
  const selectedMonthLabel = formatDateKey(`${selectedMonth}-01`, { month: "long", year: "numeric" });
  const [draftTime, setDraftTime] = useState("");
  const todayKey = toDateKey(new Date(), timeZone);
  const [dateTimes, setDateTimes] = useState<Record<string, Record<string, number>>>({});

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (new URLSearchParams(window.location.search).get("nuevo") === "1") {
        setEditingService(null);
        setDateTimes({});
        setSelectedDate("");
        setDraftTime("");
        setMessage(null);
        setDrawerOpen(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function openNewService() {
    setEditingService(null);
    setDateTimes({});
    setSelectedDate("");
    setDraftTime("");
    setMessage(null);
    setDrawerOpen(true);
  }

  function openEditService(service: Service) {
    const editableMonths = new Set(options.map((option) => option.key));
    const serviceTimes = availabilitySlots.reduce<Record<string, Record<string, number>>>((result, slot) => {
      if (slot.service_id !== service.id || !slot.is_active || !editableMonths.has(toMonthKey(slot.starts_at, timeZone))) return result;
      const day = toDateKey(slot.starts_at, timeZone);
      result[day] = { ...(result[day] ?? {}), [toTimeKey(slot.starts_at, timeZone)]: slot.capacity ?? 1 };
      return result;
    }, {});

    setEditingService(service);
    setDateTimes(serviceTimes);
    setSelectedDate("");
    setDraftTime("");
    setMessage(null);
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (pending) return;
    setDrawerOpen(false);
  }

  function addTime() {
    if (!selectedDate || !draftTime) {
      setMessage("Elegí un día y una hora para preparar la disponibilidad.");
      return;
    }
    if (zonedTimeToUtc(selectedDate, draftTime, timeZone).getTime() <= Date.now()) {
      setMessage("Ese horario ya pasó. Elegí un horario futuro.");
      return;
    }
    setMessage(null);
    setDateTimes((current) => ({ ...current, [selectedDate]: { ...(current[selectedDate] ?? {}), [draftTime]: current[selectedDate]?.[draftTime] ?? 1 } }));
    setDraftTime("");
  }

  function removeTime(day: string, time: string) {
    setDateTimes((current) => {
      const next = { ...current };
      const remaining = { ...(next[day] ?? {}) };
      delete remaining[time];
      if (Object.keys(remaining).length) next[day] = remaining;
      else delete next[day];
      return next;
    });
  }

  function changeCapacity(day: string, time: string, value: number) {
    setDateTimes((current) => ({
      ...current,
      [day]: { ...(current[day] ?? {}), [time]: value },
    }));
  }

  function requestedSlots() {
    return Object.entries(dateTimes).flatMap(([day, times]) => Object.entries(times).map(([time, capacity]) => ({
      startsAt: zonedTimeToUtc(day, time, timeZone),
      capacity,
    })));
  }

  function validateSlots(slots: ReturnType<typeof requestedSlots>) {
    if (!slots.length) return "Agregá al menos un día y horario para publicar este servicio.";
    if (slots.some((slot) => !Number.isInteger(slot.capacity) || slot.capacity < 1 || slot.capacity > 1000)) {
      return "El cupo de cada horario debe estar entre 1 y 1000 personas.";
    }
    return null;
  }

  // Periodo editable: del primer día del primer mes al fin del último mes del selector.
  const editableWindow = {
    start: zonedTimeToUtc(`${options[0].key}-01`, "00:00", timeZone),
    end: zonedTimeToUtc(`${addMonthsToMonthKey(options[options.length - 1].key, 1)}-01`, "00:00", timeZone),
  };

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscription.hasDashboardAccess) return;
    const formElement = event.currentTarget;

    const parsed = readServiceForm(new FormData(formElement));
    if (parsed.input === null) { setMessage(parsed.error); return; }
    const slots = requestedSlots();
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
    setSelectedDate("");
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
          <section className="grid gap-4">
            <div className="flex items-center gap-2 border-b border-line pb-3"><Tag aria-hidden="true" className="text-primary" size={18} /><h3 className="font-semibold">Datos del servicio</h3></div>
            <Field defaultValue={editingService?.name} label="Nombre" maxLength={SERVICE_LIMITS.nameMax} name="name" placeholder="Consulta clínica general" />
            <Field defaultValue={editingService?.description ?? ""} label="Descripción" name="description" placeholder="Qué incluye o cómo prepararse" required={false} />
            <Field defaultValue={editingService?.image_url ?? ""} label="Imagen del servicio" name="image_url" placeholder="https://…" required={false} type="url" />
            <div className="grid gap-4 sm:grid-cols-2"><Field defaultValue={editingService ? String(editingService.duration_minutes) : "30"} inputMode="numeric" label="Duración en minutos" max={SERVICE_LIMITS.durationMax} min={SERVICE_LIMITS.durationMin} name="duration_minutes" step={1} type="number" /><Field defaultValue={editingService ? currencyInputValue(editingService.price_cents) : "0"} inputMode="decimal" label="Precio" min={0} name="price" step="0.01" type="number" /></div>
            <label className="form-label">Cobro al reservar<select className="form-control" defaultValue={editingService?.deposit_type ?? "free"} name="deposit_type"><option value="free">Reserva gratuita</option><option value="deposit">Seña configurable</option><option value="full">Seña del 100%</option></select></label>
            <Field defaultValue={editingService ? currencyInputValue(editingService.deposit_value_cents) : "0"} inputMode="decimal" label="Monto de seña" min={0} name="deposit_value" required={false} step="0.01" type="number" />
          </section>

          <section className="grid gap-4">
            <div className="flex items-center gap-2 border-b border-line pb-3"><CalendarDays aria-hidden="true" className="text-primary" size={18} /><h3 className="font-semibold">Disponibilidad mensual</h3></div>
            <label className="form-label">Mes<select className="form-control capitalize" onChange={(event) => { setSelectedMonth(event.target.value); setSelectedDate(""); }} value={selectedMonth}>{options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}</select></label>
            <div className="calendar-month">
              {['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map((day) => <span className="calendar-weekday" key={day}>{day}</span>)}
              {monthDays(selectedMonth).map((day) => day.blank ? <span key={day.key} /> : (
                <button aria-pressed={selectedDate === day.key} disabled={day.key < todayKey} title={day.key < todayKey ? "Este día ya pasó" : undefined} className={selectedDate === day.key ? "is-selected" : Object.keys(dateTimes[day.key] ?? {}).length ? "has-slots" : ""} key={day.key} onClick={() => setSelectedDate(day.key)} type="button"><strong>{day.day}</strong><small>{day.weekday}</small>{Object.keys(dateTimes[day.key] ?? {}).length ? <span><Check aria-hidden="true" size={11} />{Object.keys(dateTimes[day.key]).length}</span> : null}</button>
              ))}
            </div>
            <div className="border border-line bg-surface-subtle p-4">
              <p className="text-sm font-semibold">{selectedDate ? `Horarios para ${selectedDate}` : "Elegí un día del calendario"}</p>
              <div className="mt-3 flex gap-2"><label className="sr-only" htmlFor="service-time">Hora</label><input className="form-control" disabled={!selectedDate} id="service-time" onChange={(event) => setDraftTime(event.target.value)} type="time" value={draftTime} /><button className="button-secondary" disabled={!selectedDate || !draftTime} onClick={addTime} type="button">Agregar</button></div>
              <div className="mt-3 grid gap-2">{selectedDate && !Object.keys(dateTimes[selectedDate] ?? {}).length ? <span className="text-sm text-ink-muted">Sin horarios para este día.</span> : null}{Object.entries(dateTimes[selectedDate] ?? {}).sort(([left], [right]) => left.localeCompare(right)).map(([time, capacity]) => {
                const existing = availabilitySlots.find((slot) => editingService && slot.service_id === editingService.id && toDateKey(slot.starts_at, timeZone) === selectedDate && toTimeKey(slot.starts_at, timeZone) === time);
                const booked = existing ? getSlotOccupancy(existing, appointments).booked : 0;
                return <div className="flex flex-wrap items-center gap-3 border-b border-line py-2 last:border-0" key={time}>
                  <span className="min-w-16 font-mono text-sm font-semibold">{time}</span>
                  <label className="flex items-center gap-2 text-sm" htmlFor={`capacity-${selectedDate}-${time}`}>Cupo
                    <input className="form-control w-24 tabular-nums" id={`capacity-${selectedDate}-${time}`} max={1000} min={Math.max(1, booked)} onChange={(event) => changeCapacity(selectedDate, time, Number(event.target.value))} required type="number" value={capacity} />
                  </label>
                  {booked > 0 ? <span className="text-xs text-ink-soft">{booked} {booked === 1 ? "reserva" : "reservas"}</span> : null}
                  <button aria-label={`Quitar horario ${time}`} className="button-secondary ml-auto" disabled={booked > 0} onClick={() => removeTime(selectedDate, time)} type="button">Quitar</button>
                </div>;
              })}</div>
            </div>
          </section>
          {message ? <FormMessage type="error">{message}</FormMessage> : null}
          <div className="sticky bottom-0 -mx-5 border-t border-line bg-white px-5 pt-5 sm:-mx-7 sm:px-7"><SubmitButton disabled={!subscription.hasDashboardAccess} pending={pending}>{editingService ? "Guardar cambios" : "Guardar servicio"}</SubmitButton></div>
        </form>
      </Drawer>
    </>
  );
}

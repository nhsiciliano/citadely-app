"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Clock3, Filter, List, Plus } from "lucide-react";
import { getSlotOccupancy, type Appointment, type Service, type ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { READ_ONLY_HINT } from "@/lib/business-access";
import { addDaysToDateKey, formatDateKey, formatInTimeZone, getMinutesOfDay, startOfWeekDateKey, toDateKey, toTimeKey } from "@/lib/time";
import { AppointmentDetailDrawer, NewAppointmentDrawer, type SelectedAgendaSlot } from "../appointment-actions";
import { useWorkspace } from "../workspace-context";
import { Drawer, EmptyState, PageHeader, StatusBadge } from "../workspace-ui";

type CalendarView = "week" | "day";
type AgendaFilters = { serviceId: string; status: "all" | "available" | Appointment["status"] };

const DAY_HEADER = { weekday: "short", day: "numeric" } as const;
const DATE_RANGE = { day: "numeric", month: "long", year: "numeric" } as const;
const DEFAULT_START_HOUR = 10;
const DEFAULT_END_HOUR = 18;
const HOUR_HEIGHT = 68;
const MIN_EVENT_HEIGHT = 44;
const DENSE_HOUR_THRESHOLD = 3;

type AppointmentHourGroup = {
  appointments: Appointment[];
  hour: number;
  key: string;
};

type AppointmentLayout = {
  appointment: Appointment;
  height: number;
  lane: number;
  laneCount: number;
  top: number;
};

type AvailableSlot = ServiceAvailabilitySlot & { serviceLabel: string; booked: number; remaining: number };

type AvailableHourGroup = {
  hour: number;
  key: string;
  slots: AvailableSlot[];
};

function getHourRange(services: Service[], availabilitySlots: ServiceAvailabilitySlot[], timeZone: string) {
  const serviceIds = new Set(services.map((service) => service.id));
  const activeSlots = availabilitySlots.filter((slot) => slot.is_active && serviceIds.has(slot.service_id));

  if (activeSlots.length === 0) {
    return { startHour: DEFAULT_START_HOUR, endHour: DEFAULT_END_HOUR };
  }

  let earliestStart = 24 * 60;
  let latestEnd = 0;

  for (const slot of activeSlots) {
    const start = new Date(slot.starts_at);
    const end = new Date(slot.ends_at);
    const startMinutes = getMinutesOfDay(start, timeZone);
    const durationMinutes = Math.max(0, (end.getTime() - start.getTime()) / 60000);
    earliestStart = Math.min(earliestStart, startMinutes);
    latestEnd = Math.max(latestEnd, startMinutes + durationMinutes);
  }

  const startHour = Math.floor(earliestStart / 60);
  const endHour = Math.min(24, Math.max(startHour + 1, Math.ceil(latestEnd / 60)));
  return { startHour, endHour };
}

function isOnDay(value: string, dateKey: string, timeZone: string) {
  return toDateKey(value, timeZone) === dateKey;
}

function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function formatTime(value: string, timeZone: string) {
  return toTimeKey(value, timeZone);
}

function getHourKey(value: string, hour: number, timeZone: string) {
  return `${toDateKey(value, timeZone)}-${hour}`;
}

function getHour(value: string, timeZone: string) {
  return Math.floor(getMinutesOfDay(value, timeZone) / 60);
}

function groupAppointmentsByHour(appointments: Appointment[], timeZone: string) {
  const grouped = new Map<string, AppointmentHourGroup>();

  for (const appointment of appointments) {
    const hour = getHour(appointment.starts_at, timeZone);
    const key = getHourKey(appointment.starts_at, hour, timeZone);
    const group = grouped.get(key) ?? { appointments: [], hour, key };
    group.appointments.push(appointment);
    grouped.set(key, group);
  }

  return [...grouped.values()].map((group) => ({
    ...group,
    appointments: group.appointments.sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()),
  }));
}

function groupAvailableSlotsByHour(slots: AvailableSlot[], timeZone: string) {
  const grouped = new Map<string, AvailableHourGroup>();

  for (const slot of slots) {
    const hour = getHour(slot.starts_at, timeZone);
    const key = `available-${getHourKey(slot.starts_at, hour, timeZone)}`;
    const group = grouped.get(key) ?? { hour, key, slots: [] };
    group.slots.push(slot);
    grouped.set(key, group);
  }

  return [...grouped.values()].map((group) => ({
    ...group,
    slots: group.slots.sort((left, right) => new Date(left.starts_at).getTime() - new Date(right.starts_at).getTime()),
  }));
}

function layoutAppointments(appointments: Appointment[], startHour: number, timeZone: string): AppointmentLayout[] {
  const positioned = appointments
    .map((appointment) => {
      const start = new Date(appointment.starts_at);
      const end = new Date(appointment.ends_at);
      const minutes = getMinutesOfDay(start, timeZone) - startHour * 60;
      const duration = Math.max(1, (end.getTime() - start.getTime()) / 60000);
      const top = Math.max(0, minutes * HOUR_HEIGHT / 60);
      return { appointment, height: Math.max(MIN_EVENT_HEIGHT, duration * HOUR_HEIGHT / 60), top };
    })
    .sort((left, right) => left.top - right.top);
  const layouts: AppointmentLayout[] = [];
  let cluster: typeof positioned = [];
  let clusterEnd = -1;

  function commitCluster() {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const staged = cluster.map((item) => {
      let lane = laneEnds.findIndex((end) => end <= item.top);
      if (lane === -1) lane = laneEnds.length;
      laneEnds[lane] = item.top + item.height;
      return { ...item, lane };
    });
    const laneCount = Math.max(1, laneEnds.length);
    layouts.push(...staged.map((item) => ({ ...item, laneCount })));
    cluster = [];
    clusterEnd = -1;
  }

  for (const item of positioned) {
    if (cluster.length > 0 && item.top >= clusterEnd) commitCluster();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.top + item.height);
  }
  commitCluster();

  return layouts;
}

function summarizeServices(appointments: Appointment[]) {
  const services = [...new Set(appointments.map((appointment) => appointment.services?.name ?? "Servicio"))];
  if (services.length <= 2) return services.join(" · ");
  return `${services.slice(0, 2).join(" · ")} +${services.length - 2}`;
}

function AgendaDayColumn({
  appointments,
  availableSlots,
  hours,
  onOpenAppointment,
  onOpenAvailableHour,
  onOpenAvailableSlot,
  onOpenHour,
  startHour,
  timeZone,
}: {
  appointments: Appointment[];
  availableSlots: AvailableSlot[];
  hours: number[];
  onOpenAppointment: (id: string) => void;
  onOpenAvailableHour: (key: string) => void;
  onOpenAvailableSlot: (slot: AvailableSlot) => void;
  onOpenHour: (key: string) => void;
  startHour: number;
  timeZone: string;
}) {
  const hourGroups = groupAppointmentsByHour(appointments, timeZone);
  const denseGroups = hourGroups.filter((group) => group.appointments.length >= DENSE_HOUR_THRESHOLD);
  const denseAppointmentIds = new Set(denseGroups.flatMap((group) => group.appointments.map((appointment) => appointment.id)));
  const layouts = layoutAppointments(appointments.filter((appointment) => !denseAppointmentIds.has(appointment.id)), startHour, timeZone);
  const availableHourGroups = groupAvailableSlotsByHour(availableSlots, timeZone);
  const denseAvailableGroups = availableHourGroups.filter((group) => group.slots.length >= DENSE_HOUR_THRESHOLD);
  const denseAvailableKeys = new Set(denseAvailableGroups.flatMap((group) => group.slots.map((slot) => slot.id ?? `${slot.service_id}-${slot.starts_at}`)));
  const individualAvailableSlots = availableSlots.filter((slot) => !denseAvailableKeys.has(slot.id ?? `${slot.service_id}-${slot.starts_at}`));

  return (
    <div className="calendar-day-column" style={{ height: (hours.length - 1) * HOUR_HEIGHT }}>
      {hours.map((hour) => <span aria-hidden="true" className="absolute inset-x-0 border-t border-[var(--color-line)]" key={hour} style={{ top: (hour - startHour) * HOUR_HEIGHT }} />)}
      {individualAvailableSlots.map((slot) => {
        const start = new Date(slot.starts_at);
        const end = new Date(slot.ends_at);
        const minutes = getMinutesOfDay(start, timeZone) - startHour * 60;
        const duration = Math.max(1, (end.getTime() - start.getTime()) / 60000);
        const height = Math.max(20, duration * HOUR_HEIGHT / 60);
        const compact = height < 40;
        return (
          <button
            aria-label={`Turno libre a las ${formatTime(slot.starts_at, timeZone)} para ${slot.serviceLabel}. ${slot.remaining} de ${slot.capacity} lugares disponibles`}
            className={`calendar-event calendar-event-available ${compact ? "calendar-event-compact" : ""}`}
            key={slot.id ?? `${slot.service_id}-${slot.starts_at}`}
            onClick={() => onOpenAvailableSlot(slot)}
            style={{ top: Math.max(0, minutes * HOUR_HEIGHT / 60), height }}
            type="button"
          >
            <span className="font-mono text-[11px] font-semibold">{formatTime(slot.starts_at, timeZone)}</span>
            <strong>Turno libre</strong>
            <small>{slot.serviceLabel} · {slot.remaining} de {slot.capacity}</small>
          </button>
        );
      })}
      {denseAvailableGroups.map((group) => {
        const serviceLabels = [...new Set(group.slots.map((slot) => slot.serviceLabel))];
        const serviceSummary = serviceLabels.length <= 2 ? serviceLabels.join(" · ") : `${serviceLabels.slice(0, 2).join(" · ")} +${serviceLabels.length - 2}`;
        const range = `${formatHour(group.hour)}–${formatHour(group.hour + 1)}`;
        return (
          <button
            aria-label={`${group.slots.length} horarios libres entre ${formatHour(group.hour)} y ${formatHour(group.hour + 1)}. Ver horarios`}
            className="calendar-hour-summary calendar-hour-summary-available"
            key={group.key}
            onClick={() => onOpenAvailableHour(group.key)}
            style={{ top: (group.hour - startHour) * HOUR_HEIGHT + 4, height: HOUR_HEIGHT - 8 }}
            type="button"
          >
            <span className="calendar-hour-summary-heading"><strong>{group.slots.length} libres</strong><span>{range}</span></span>
            <small>{serviceSummary}</small>
            <span aria-hidden="true" className="calendar-availability-mark" />
          </button>
        );
      })}
      {denseGroups.map((group) => {
        const statuses = [...new Set(group.appointments.map((appointment) => appointment.status))];
        const range = `${formatHour(group.hour)}–${formatHour(group.hour + 1)}`;
        return (
          <button
            aria-label={`${group.appointments.length} turnos entre ${formatHour(group.hour)} y ${formatHour(group.hour + 1)}. Ver detalle`}
            className="calendar-hour-summary"
            key={group.key}
            onClick={() => onOpenHour(group.key)}
            style={{ top: (group.hour - startHour) * HOUR_HEIGHT + 4, height: HOUR_HEIGHT - 8 }}
            type="button"
          >
            <span className="calendar-hour-summary-heading"><strong>{group.appointments.length} turnos</strong><span>{range}</span></span>
            <small>{summarizeServices(group.appointments)}</small>
            <span aria-hidden="true" className="calendar-hour-summary-statuses">
              {statuses.map((status) => <i className={`calendar-status-dot calendar-status-dot-${status}`} key={status} />)}
            </span>
          </button>
        );
      })}
      {layouts.map(({ appointment, height, lane, laneCount, top }) => {
        const width = `calc(${100 / laneCount}% - ${laneCount === 1 ? 0.7 : 0.45}rem)`;
        const left = `calc(${lane * 100 / laneCount}% + 0.35rem)`;
        return (
          <button
            aria-label={`${formatTime(appointment.starts_at, timeZone)}, ${appointment.services?.name ?? "Servicio"}, ${appointment.clients?.name ?? "Cliente"}`}
            className={`calendar-event calendar-event-${appointment.status}`}
            key={appointment.id}
            onClick={() => onOpenAppointment(appointment.id)}
            style={{ top, height, left, right: "auto", width }}
            type="button"
          >
            <span className="font-mono text-[11px] font-semibold">{formatTime(appointment.starts_at, timeZone)}</span>
            <strong>{appointment.services?.name ?? "Servicio"}</strong>
            <small>{appointment.clients?.name ?? "Cliente"}</small>
          </button>
        );
      })}
    </div>
  );
}

export function AgendaScreen() {
  const { access, appointments, availabilitySlots, business, services } = useWorkspace();
  const readOnly = !access.hasDashboardAccess;
  const timeZone = business.timezone;
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(() => toDateKey(new Date(), timeZone));
  const [currentTime] = useState(() => Date.now());
  const [filters, setFilters] = useState<AgendaFilters>({ serviceId: "all", status: "all" });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedAgendaSlot, setSelectedAgendaSlot] = useState<SelectedAgendaSlot | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedHourKey, setSelectedHourKey] = useState<string | null>(null);
  const [selectedAvailableHourKey, setSelectedAvailableHourKey] = useState<string | null>(null);
  const { startHour, endHour } = useMemo(
    () => getHourRange(services, availabilitySlots, timeZone),
    [availabilitySlots, services, timeZone],
  );
  const hours = useMemo(
    () => Array.from({ length: endHour - startHour + 1 }, (_, index) => startHour + index),
    [endHour, startHour],
  );
  const calendarHeight = (endHour - startHour) * HOUR_HEIGHT;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const frame = window.requestAnimationFrame(() => {
      if (mediaQuery.matches) setView("day");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const todayKey = toDateKey(new Date(), timeZone);
  const weekStart = startOfWeekDateKey(anchorDate);
  const days = useMemo(
    () => view === "week" ? Array.from({ length: 7 }, (_, index) => addDaysToDateKey(weekStart, index)) : [anchorDate],
    [anchorDate, view, weekStart],
  );
  const visibleAppointments = useMemo(() => appointments.filter((appointment) => {
    if (filters.status === "available") return false;
    if (filters.serviceId !== "all" && appointment.service_id !== filters.serviceId) return false;
    if (filters.status !== "all" && appointment.status !== filters.status) return false;
    return days.some((day) => isOnDay(appointment.starts_at, day, timeZone));
  }), [appointments, days, filters, timeZone]);
  const visibleAvailableSlots = useMemo(() => {
    if (filters.status !== "available") return [];
    const activeServiceIds = new Set(services.filter((service) => service.is_active).map((service) => service.id));
    const freeSlots = availabilitySlots.flatMap((slot) => {
      if (!slot.is_active || !activeServiceIds.has(slot.service_id) || new Date(slot.starts_at).getTime() <= currentTime) return [];
      if (filters.serviceId !== "all" && slot.service_id !== filters.serviceId) return [];
      if (!days.some((day) => isOnDay(slot.starts_at, day, timeZone))) return [];
      const occupancy = getSlotOccupancy(slot, appointments, currentTime);
      return occupancy.remaining > 0 ? [{ ...slot, booked: occupancy.booked, remaining: occupancy.remaining }] : [];
    });

    if (filters.serviceId !== "all") {
      const service = services.find((item) => item.id === filters.serviceId);
      return freeSlots.map((slot) => ({ ...slot, serviceLabel: service?.name ?? "Servicio" }));
    }

    const grouped = new Map<string, (ServiceAvailabilitySlot & { booked: number; remaining: number })[]>();
    for (const slot of freeSlots) {
      const key = new Date(slot.starts_at).toISOString();
      grouped.set(key, [...(grouped.get(key) ?? []), slot]);
    }
    return [...grouped.values()].map((slots) => {
      const longest = slots.reduce((current, slot) => new Date(slot.ends_at) > new Date(current.ends_at) ? slot : current);
      return { ...longest, serviceLabel: `${slots.length} servicio${slots.length === 1 ? "" : "s"}` };
    });
  }, [appointments, availabilitySlots, currentTime, days, filters, services, timeZone]);
  const denseHourGroups = useMemo(
    () => groupAppointmentsByHour(visibleAppointments, timeZone).filter((group) => group.appointments.length >= DENSE_HOUR_THRESHOLD),
    [timeZone, visibleAppointments],
  );
  const selectedHourGroup = denseHourGroups.find((group) => group.key === selectedHourKey) ?? null;
  const denseAvailableHourGroups = useMemo(
    () => groupAvailableSlotsByHour(visibleAvailableSlots, timeZone).filter((group) => group.slots.length >= DENSE_HOUR_THRESHOLD),
    [timeZone, visibleAvailableSlots],
  );
  const selectedAvailableHourGroup = denseAvailableHourGroups.find((group) => group.key === selectedAvailableHourKey) ?? null;
  const selected = appointments.find((appointment) => appointment.id === selectedId) ?? null;
  const rangeLabel = view === "day" ? formatDateKey(anchorDate, DATE_RANGE) : `${formatDateKey(days[0], DATE_RANGE)} — ${formatDateKey(days[6], DATE_RANGE)}`;

  function navigate(direction: -1 | 1) {
    setAnchorDate((current) => addDaysToDateKey(current, direction * (view === "week" ? 7 : 1)));
  }

  function openAvailableSlot(slot: AvailableSlot) {
    setSelectedAvailableHourKey(null);
    setSelectedAgendaSlot({
      startsAt: new Date(slot.starts_at).toISOString(),
      serviceId: filters.serviceId === "all" ? undefined : filters.serviceId,
    });
    setCreateOpen(true);
  }

  return (
    <>
      <PageHeader
        actions={<button className="button-primary" disabled={readOnly} onClick={() => { setSelectedAgendaSlot(null); setCreateOpen(true); }} title={readOnly ? READ_ONLY_HINT : undefined} type="button"><Plus aria-hidden="true" size={18} />Nuevo turno</button>}
        description="Navegá por día o semana, filtrá la operación y abrí cada turno sin perder el contexto temporal."
        title="Agenda"
      />

      <div className="px-4 py-5 sm:px-8 lg:px-10 lg:py-8">
        <section className="overflow-hidden border border-[var(--color-line)] bg-white shadow-[var(--shadow-surface)]">
          <div className="flex flex-col gap-4 border-b border-[var(--color-line)] px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button aria-label="Período anterior" className="icon-button" onClick={() => navigate(-1)} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>
              <button className="button-secondary" onClick={() => setAnchorDate(toDateKey(new Date(), timeZone))} type="button">Hoy</button>
              <button aria-label="Período siguiente" className="icon-button" onClick={() => navigate(1)} type="button"><ChevronRight aria-hidden="true" size={18} /></button>
              <p className="ml-2 text-sm font-semibold capitalize text-[var(--color-ink)]">{rangeLabel}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div aria-label="Vista de agenda" className="segmented-control" role="group">
                <button aria-pressed={view === "day"} onClick={() => setView("day")} type="button"><List aria-hidden="true" size={16} />Día</button>
                <button aria-pressed={view === "week"} onClick={() => setView("week")} type="button"><CalendarRange aria-hidden="true" size={16} />Semana</button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface-subtle)] px-4 py-3 sm:px-6">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]"><Filter aria-hidden="true" size={15} />Filtros</span>
            <label className="sr-only" htmlFor="agenda-service">Filtrar por servicio</label>
            <select className="compact-control" id="agenda-service" onChange={(event) => setFilters((current) => ({ ...current, serviceId: event.target.value }))} value={filters.serviceId}>
              <option value="all">Todos los servicios</option>
              {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
            </select>
            <label className="sr-only" htmlFor="agenda-status">Filtrar por estado</label>
            <select className="compact-control" id="agenda-status" onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as AgendaFilters["status"] }))} value={filters.status}>
              <option value="all">Todos los estados</option>
              <option value="available">Turnos libres</option>
              <option value="confirmed">Confirmados</option>
              <option value="pending_payment">Seña pendiente</option>
              <option value="completed">Completados</option>
              <option value="cancelled">Cancelados</option>
              <option value="no_show">No asistió</option>
            </select>
          </div>

          {visibleAppointments.length === 0 && visibleAvailableSlots.length === 0 ? (
            <div className="p-6"><EmptyState action={<button className="button-primary" disabled={readOnly} onClick={() => setCreateOpen(true)} title={readOnly ? READ_ONLY_HINT : undefined} type="button"><Plus aria-hidden="true" size={17} />Crear turno</button>} text={filters.status === "available" ? "Publicá disponibilidad desde Servicios o probá otro período." : "Probá otro período o quitá los filtros. También podés cargar un turno manual."} title={filters.status === "available" ? "No hay turnos libres en esta vista" : "No hay turnos en esta vista"} /></div>
          ) : null}

          <div className="overflow-x-auto">
            <div className={view === "week" ? "min-w-[1020px]" : "min-w-[520px]"}>
              <div className="grid border-b border-[var(--color-line)]" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="border-r border-[var(--color-line)] bg-[var(--color-surface-subtle)]" />
                {days.map((day) => (
                  <div className={`border-r border-[var(--color-line)] px-3 py-3 text-center last:border-r-0 ${day === todayKey ? "bg-[var(--color-primary-soft)]" : ""}`} key={day}>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">{formatDateKey(day, DAY_HEADER).split(" ")[0]}</p>
                    <p className={`mt-1 font-mono text-lg font-semibold ${day === todayKey ? "text-[var(--color-primary)]" : ""}`}>{Number(day.slice(8))}</p>
                  </div>
                ))}
              </div>

              <div className="grid" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="relative border-r border-[var(--color-line)] bg-[var(--color-surface-subtle)]" style={{ height: calendarHeight }}>
                  {hours.map((hour) => <span className="absolute right-3 -translate-y-1/2 font-mono text-[11px] text-[var(--color-ink-muted)]" key={hour} style={{ top: (hour - startHour) * HOUR_HEIGHT }}>{String(hour).padStart(2, "0")}:00</span>)}
                </div>
                {days.map((day) => (
                  <AgendaDayColumn
                    appointments={visibleAppointments.filter((appointment) => isOnDay(appointment.starts_at, day, timeZone))}
                    availableSlots={visibleAvailableSlots.filter((slot) => isOnDay(slot.starts_at, day, timeZone))}
                    hours={hours}
                    key={day}
                    onOpenAppointment={setSelectedId}
                    onOpenAvailableHour={setSelectedAvailableHourKey}
                    onOpenAvailableSlot={openAvailableSlot}
                    onOpenHour={setSelectedHourKey}
                    startHour={startHour}
                    timeZone={timeZone}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <NewAppointmentDrawer initialSlot={selectedAgendaSlot} key={selectedAgendaSlot ? `${selectedAgendaSlot.startsAt}-${selectedAgendaSlot.serviceId ?? "all"}` : "manual"} onClose={() => { setCreateOpen(false); setSelectedAgendaSlot(null); }} open={createOpen} />
      <Drawer
        description={selectedAvailableHourGroup ? `${formatInTimeZone(selectedAvailableHourGroup.slots[0].starts_at, timeZone, DAY_HEADER)} · ${formatHour(selectedAvailableHourGroup.hour)}–${formatHour(selectedAvailableHourGroup.hour + 1)}` : undefined}
        onClose={() => setSelectedAvailableHourKey(null)}
        open={Boolean(selectedAvailableHourGroup)}
        title={selectedAvailableHourGroup ? `${selectedAvailableHourGroup.slots.length} horarios libres` : "Horarios libres"}
        width="medium"
      >
        {selectedAvailableHourGroup ? (
          <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {selectedAvailableHourGroup.slots.map((slot) => (
              <button aria-label={`Asignar turno libre a las ${formatTime(slot.starts_at, timeZone)} para ${slot.serviceLabel}`} className="agenda-hour-row" key={slot.id ?? `${slot.service_id}-${slot.starts_at}`} onClick={() => openAvailableSlot(slot)} type="button">
                <span className="agenda-hour-row-time"><Clock3 aria-hidden="true" size={15} />{formatTime(slot.starts_at, timeZone)}</span>
                <span className="min-w-0">
                  <strong>Turno libre</strong>
                  <small>{slot.serviceLabel} · {slot.remaining} de {slot.capacity} lugares</small>
                </span>
                <span className="status-badge status-confirmed">Disponible</span>
                <ChevronRight aria-hidden="true" className="text-[var(--color-ink-muted)]" size={17} />
              </button>
            ))}
          </div>
        ) : null}
      </Drawer>
      <Drawer
        description={selectedHourGroup ? `${formatInTimeZone(selectedHourGroup.appointments[0].starts_at, timeZone, DAY_HEADER)} · ${formatHour(selectedHourGroup.hour)}–${formatHour(selectedHourGroup.hour + 1)}` : undefined}
        onClose={() => setSelectedHourKey(null)}
        open={Boolean(selectedHourGroup)}
        title={selectedHourGroup ? `${selectedHourGroup.appointments.length} turnos en esta hora` : "Turnos de esta hora"}
        width="medium"
      >
        {selectedHourGroup ? (
          <div className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
            {selectedHourGroup.appointments.map((appointment) => (
              <button
                aria-label={`Abrir turno de ${appointment.clients?.name ?? "Cliente"} a las ${formatTime(appointment.starts_at, timeZone)}`}
                className="agenda-hour-row"
                key={appointment.id}
                onClick={() => {
                  setSelectedHourKey(null);
                  setSelectedId(appointment.id);
                }}
                type="button"
              >
                <span className="agenda-hour-row-time"><Clock3 aria-hidden="true" size={15} />{formatTime(appointment.starts_at, timeZone)}</span>
                <span className="min-w-0">
                  <strong>{appointment.clients?.name ?? "Cliente"}</strong>
                  <small>{appointment.services?.name ?? "Servicio"}</small>
                </span>
                <StatusBadge status={appointment.status} />
                <ChevronRight aria-hidden="true" className="text-[var(--color-ink-muted)]" size={17} />
              </button>
            ))}
          </div>
        ) : null}
      </Drawer>
      <AppointmentDetailDrawer appointment={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}

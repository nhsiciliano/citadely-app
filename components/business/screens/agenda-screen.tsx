"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  DAY_HEADER,
  DATE_RANGE,
  DENSE_HOUR_THRESHOLD,
  HOUR_HEIGHT,
  computeVisibleAvailableSlots,
  filterVisibleAppointments,
  getHourRange,
  groupAppointmentsByHour,
  groupAvailableSlotsByHour,
  isOnDay,
  type AgendaFilters,
  type AvailableSlot,
  type CalendarView,
} from "@/lib/agenda-layout";
import { READ_ONLY_HINT } from "@/lib/business-access";
import { addDaysToDateKey, formatDateKey, startOfDayInTimeZone, startOfWeekDateKey, toDateKey } from "@/lib/time";
import { AgendaDayColumn } from "../agenda/agenda-day-column";
import { AgendaToolbar } from "../agenda/agenda-toolbar";
import { AppointmentHoursDrawer, AvailableHoursDrawer } from "../agenda/agenda-hour-drawers";
import { AppointmentDetailDrawer, NewAppointmentDrawer, type SelectedAgendaSlot } from "../appointment-actions";
import { useWorkspace } from "../workspace-context";
import { EmptyState, PageHeader } from "../workspace-ui";

export function AgendaScreen() {
  const { access, appointments, availabilitySlots, business, ensureHistoryFrom, services } = useWorkspace();
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
  // El workspace solo trae los últimos días: al navegar más atrás se piden los turnos y horarios que faltan.
  const firstVisibleDay = days[0];
  useEffect(() => {
    void ensureHistoryFrom(startOfDayInTimeZone(firstVisibleDay, timeZone));
    // ensureHistoryFrom cambia en cada render del proveedor; solo importa el primer día visible.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstVisibleDay, timeZone]);
  const visibleAppointments = useMemo(
    () => filterVisibleAppointments(appointments, { days, filters, timeZone }),
    [appointments, days, filters, timeZone],
  );
  const visibleAvailableSlots = useMemo(
    () => computeVisibleAvailableSlots({ appointments, availabilitySlots, days, filters, now: currentTime, services, timeZone }),
    [appointments, availabilitySlots, currentTime, days, filters, services, timeZone],
  );
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
        <section className="overflow-hidden border border-line bg-white shadow-surface">
          <AgendaToolbar
            filters={filters}
            onFiltersChange={setFilters}
            onNavigate={navigate}
            onToday={() => setAnchorDate(toDateKey(new Date(), timeZone))}
            onViewChange={setView}
            rangeLabel={rangeLabel}
            services={services}
            view={view}
          />

          {visibleAppointments.length === 0 && visibleAvailableSlots.length === 0 ? (
            <div className="p-6"><EmptyState action={<button className="button-primary" disabled={readOnly} onClick={() => setCreateOpen(true)} title={readOnly ? READ_ONLY_HINT : undefined} type="button"><Plus aria-hidden="true" size={17} />Crear turno</button>} text={filters.status === "available" ? "Publicá disponibilidad desde Servicios o probá otro período." : "Probá otro período o quitá los filtros. También podés cargar un turno manual."} title={filters.status === "available" ? "No hay turnos libres en esta vista" : "No hay turnos en esta vista"} /></div>
          ) : null}

          <div className="overflow-x-auto">
            <div className={view === "week" ? "min-w-[1020px]" : "min-w-[520px]"}>
              <div className="grid border-b border-line" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="border-r border-line bg-surface-subtle" />
                {days.map((day) => (
                  <div className={`border-r border-line px-3 py-3 text-center last:border-r-0 ${day === todayKey ? "bg-primary-soft" : ""}`} key={day}>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">{formatDateKey(day, DAY_HEADER).split(" ")[0]}</p>
                    <p className={`mt-1 font-mono text-lg font-semibold ${day === todayKey ? "text-primary" : ""}`}>{Number(day.slice(8))}</p>
                  </div>
                ))}
              </div>

              <div className="grid" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="relative border-r border-line bg-surface-subtle" style={{ height: calendarHeight }}>
                  {hours.map((hour) => <span className="absolute right-3 -translate-y-1/2 font-mono text-[11px] text-ink-muted" key={hour} style={{ top: (hour - startHour) * HOUR_HEIGHT }}>{String(hour).padStart(2, "0")}:00</span>)}
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
      <AvailableHoursDrawer group={selectedAvailableHourGroup} onClose={() => setSelectedAvailableHourKey(null)} onSelectSlot={openAvailableSlot} timeZone={timeZone} />
      <AppointmentHoursDrawer
        group={selectedHourGroup}
        onClose={() => setSelectedHourKey(null)}
        onSelectAppointment={(id) => {
          setSelectedHourKey(null);
          setSelectedId(id);
        }}
        timeZone={timeZone}
      />
      <AppointmentDetailDrawer appointment={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}

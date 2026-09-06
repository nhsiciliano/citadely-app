"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Filter, List, Plus } from "lucide-react";
import type { Appointment } from "@/lib/citadely-db";
import { AppointmentDetailDrawer, NewAppointmentDrawer } from "../appointment-actions";
import { useWorkspace } from "../workspace-context";
import { EmptyState, PageHeader } from "../workspace-ui";

type CalendarView = "week" | "day";
type AgendaFilters = { serviceId: string; status: "all" | Appointment["status"] };

const DAY_HEADER = new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric" });
const DATE_RANGE = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric" });
const HOURS = Array.from({ length: 13 }, (_, index) => index + 8);
const HOUR_HEIGHT = 68;

function startOfWeek(value: Date) {
  const date = new Date(value);
  const weekday = date.getDay() || 7;
  date.setDate(date.getDate() - weekday + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(value: Date, days: number) {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
}

function sameDay(left: Date, right: Date) {
  return left.toDateString() === right.toDateString();
}

export function AgendaScreen() {
  const { appointments, services } = useWorkspace();
  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [filters, setFilters] = useState<AgendaFilters>({ serviceId: "all", status: "all" });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const frame = window.requestAnimationFrame(() => {
      if (mediaQuery.matches) setView("day");
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const weekStart = startOfWeek(anchorDate);
  const days = useMemo(
    () => view === "week" ? Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)) : [anchorDate],
    [anchorDate, view, weekStart],
  );
  const visibleAppointments = useMemo(() => appointments.filter((appointment) => {
    if (filters.serviceId !== "all" && appointment.service_id !== filters.serviceId) return false;
    if (filters.status !== "all" && appointment.status !== filters.status) return false;
    return days.some((day) => sameDay(new Date(appointment.starts_at), day));
  }), [appointments, days, filters]);
  const selected = appointments.find((appointment) => appointment.id === selectedId) ?? null;
  const rangeLabel = view === "day" ? DATE_RANGE.format(anchorDate) : `${DATE_RANGE.format(days[0])} — ${DATE_RANGE.format(days[6])}`;

  function navigate(direction: -1 | 1) {
    setAnchorDate((current) => addDays(current, direction * (view === "week" ? 7 : 1)));
  }

  return (
    <>
      <PageHeader
        actions={<button className="button-primary" onClick={() => setCreateOpen(true)} type="button"><Plus aria-hidden="true" size={18} />Nuevo turno</button>}
        description="Navegá por día o semana, filtrá la operación y abrí cada turno sin perder el contexto temporal."
        title="Agenda"
      />

      <div className="px-4 py-5 sm:px-8 lg:px-10 lg:py-8">
        <section className="overflow-hidden border border-[var(--color-line)] bg-white shadow-[var(--shadow-surface)]">
          <div className="flex flex-col gap-4 border-b border-[var(--color-line)] px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2">
              <button aria-label="Período anterior" className="icon-button" onClick={() => navigate(-1)} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>
              <button className="button-secondary" onClick={() => setAnchorDate(new Date())} type="button">Hoy</button>
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
              <option value="confirmed">Confirmados</option>
              <option value="pending_payment">Seña pendiente</option>
              <option value="completed">Completados</option>
              <option value="cancelled">Cancelados</option>
              <option value="no_show">No asistió</option>
            </select>
          </div>

          {visibleAppointments.length === 0 ? (
            <div className="p-6"><EmptyState action={<button className="button-primary" onClick={() => setCreateOpen(true)} type="button"><Plus aria-hidden="true" size={17} />Crear turno</button>} text="Probá otro período o quitá los filtros. También podés cargar un turno manual." title="No hay turnos en esta vista" /></div>
          ) : null}

          <div className="overflow-x-auto">
            <div className={view === "week" ? "min-w-[1020px]" : "min-w-[520px]"}>
              <div className="grid border-b border-[var(--color-line)]" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="border-r border-[var(--color-line)] bg-[var(--color-surface-subtle)]" />
                {days.map((day) => (
                  <div className={`border-r border-[var(--color-line)] px-3 py-3 text-center last:border-r-0 ${sameDay(day, new Date()) ? "bg-[var(--color-primary-soft)]" : ""}`} key={day.toISOString()}>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">{DAY_HEADER.format(day).split(" ")[0]}</p>
                    <p className={`mt-1 font-mono text-lg font-semibold ${sameDay(day, new Date()) ? "text-[var(--color-primary)]" : ""}`}>{day.getDate()}</p>
                  </div>
                ))}
              </div>

              <div className="grid" style={{ gridTemplateColumns: `72px repeat(${days.length}, minmax(0, 1fr))` }}>
                <div className="relative border-r border-[var(--color-line)] bg-[var(--color-surface-subtle)]" style={{ height: HOURS.length * HOUR_HEIGHT }}>
                  {HOURS.map((hour) => <span className="absolute right-3 -translate-y-1/2 font-mono text-[11px] text-[var(--color-ink-muted)]" key={hour} style={{ top: (hour - 8) * HOUR_HEIGHT }}>{String(hour).padStart(2, "0")}:00</span>)}
                </div>
                {days.map((day) => (
                  <div className="calendar-day-column" key={day.toISOString()} style={{ height: HOURS.length * HOUR_HEIGHT }}>
                    {HOURS.map((hour) => <span aria-hidden="true" className="absolute inset-x-0 border-t border-[var(--color-line)]" key={hour} style={{ top: (hour - 8) * HOUR_HEIGHT }} />)}
                    {visibleAppointments.filter((appointment) => sameDay(new Date(appointment.starts_at), day)).map((appointment) => {
                      const start = new Date(appointment.starts_at);
                      const end = new Date(appointment.ends_at);
                      const minutes = (start.getHours() - 8) * 60 + start.getMinutes();
                      const duration = Math.max(30, (end.getTime() - start.getTime()) / 60000);
                      return (
                        <button
                          className={`calendar-event calendar-event-${appointment.status}`}
                          key={appointment.id}
                          onClick={() => setSelectedId(appointment.id)}
                          style={{ top: Math.max(0, minutes * HOUR_HEIGHT / 60), height: Math.max(44, duration * HOUR_HEIGHT / 60) }}
                          type="button"
                        >
                          <span className="font-mono text-[11px] font-semibold">{String(start.getHours()).padStart(2, "0")}:{String(start.getMinutes()).padStart(2, "0")}</span>
                          <strong>{appointment.services?.name ?? "Servicio"}</strong>
                          <small>{appointment.clients?.name ?? "Cliente"}</small>
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <NewAppointmentDrawer onClose={() => setCreateOpen(false)} open={createOpen} />
      <AppointmentDetailDrawer appointment={selected} onClose={() => setSelectedId(null)} />
    </>
  );
}

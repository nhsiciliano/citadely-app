import { CalendarRange, ChevronLeft, ChevronRight, Filter, List } from "lucide-react";
import type { AgendaFilters, CalendarView } from "@/lib/agenda-layout";
import type { Service } from "@/lib/citadely-db";

export function AgendaToolbar({
  filters,
  onFiltersChange,
  onNavigate,
  onToday,
  onViewChange,
  rangeLabel,
  services,
  view,
}: {
  filters: AgendaFilters;
  onFiltersChange: (filters: AgendaFilters) => void;
  onNavigate: (direction: -1 | 1) => void;
  onToday: () => void;
  onViewChange: (view: CalendarView) => void;
  rangeLabel: string;
  services: Service[];
  view: CalendarView;
}) {
  return (
    <>
  <div className="flex flex-col gap-4 border-b border-line px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
    <div className="flex items-center gap-2">
      <button aria-label="Período anterior" className="icon-button" onClick={() => onNavigate(-1)} type="button"><ChevronLeft aria-hidden="true" size={18} /></button>
      <button className="button-secondary" onClick={onToday} type="button">Hoy</button>
      <button aria-label="Período siguiente" className="icon-button" onClick={() => onNavigate(1)} type="button"><ChevronRight aria-hidden="true" size={18} /></button>
      <p className="ml-2 text-sm font-semibold capitalize text-ink">{rangeLabel}</p>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <div aria-label="Vista de agenda" className="segmented-control" role="group">
        <button aria-pressed={view === "day"} onClick={() => onViewChange("day")} type="button"><List aria-hidden="true" size={16} />Día</button>
        <button aria-pressed={view === "week"} onClick={() => onViewChange("week")} type="button"><CalendarRange aria-hidden="true" size={16} />Semana</button>
      </div>
    </div>
  </div>

  <div className="flex flex-wrap items-center gap-3 border-b border-line bg-surface-subtle px-4 py-3 sm:px-6">
    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted"><Filter aria-hidden="true" size={15} />Filtros</span>
    <label className="sr-only" htmlFor="agenda-service">Filtrar por servicio</label>
    <select className="compact-control" id="agenda-service" onChange={(event) => onFiltersChange({ ...filters, serviceId: event.target.value })} value={filters.serviceId}>
      <option value="all">Todos los servicios</option>
      {services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}
    </select>
    <label className="sr-only" htmlFor="agenda-status">Filtrar por estado</label>
    <select className="compact-control" id="agenda-status" onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as AgendaFilters["status"] })} value={filters.status}>
      <option value="all">Todos los estados</option>
      <option value="available">Turnos libres</option>
      <option value="confirmed">Confirmados</option>
      <option value="pending_payment">Seña pendiente</option>
      <option value="completed">Completados</option>
      <option value="cancelled">Cancelados</option>
      <option value="no_show">No asistió</option>
    </select>
  </div>
    </>
  );
}

import { getMinutesOfDay } from "@/lib/time";
import type { Appointment } from "@/lib/citadely-db";
import {
  DENSE_HOUR_THRESHOLD,
  HOUR_HEIGHT,
  formatHour,
  formatTime,
  groupAppointmentsByHour,
  groupAvailableSlotsByHour,
  layoutAppointments,
  summarizeServices,
  type AvailableSlot,
} from "@/lib/agenda-layout";

export function AgendaDayColumn({
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
      {hours.map((hour) => <span aria-hidden="true" className="absolute inset-x-0 border-t border-line" key={hour} style={{ top: (hour - startHour) * HOUR_HEIGHT }} />)}
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

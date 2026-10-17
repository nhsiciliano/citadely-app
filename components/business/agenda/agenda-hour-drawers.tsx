import { ChevronRight, Clock3 } from "lucide-react";
import {
  DAY_HEADER,
  formatHour,
  formatTime,
  type AppointmentHourGroup,
  type AvailableHourGroup,
  type AvailableSlot,
} from "@/lib/agenda-layout";
import { formatInTimeZone } from "@/lib/time";
import { Drawer, StatusBadge } from "../workspace-ui";

/** Lists the free slots of one crowded hour so the owner can assign one of them. */
export function AvailableHoursDrawer({
  group,
  onClose,
  onSelectSlot,
  timeZone,
}: {
  group: AvailableHourGroup | null;
  onClose: () => void;
  onSelectSlot: (slot: AvailableSlot) => void;
  timeZone: string;
}) {
  return (
  <Drawer
    description={group ? `${formatInTimeZone(group.slots[0].starts_at, timeZone, DAY_HEADER)} · ${formatHour(group.hour)}–${formatHour(group.hour + 1)}` : undefined}
    onClose={onClose}
    open={Boolean(group)}
    title={group ? `${group.slots.length} horarios libres` : "Horarios libres"}
    width="medium"
  >
    {group ? (
      <div className="divide-y divide-line border-y border-line">
        {group.slots.map((slot) => (
          <button aria-label={`Asignar turno libre a las ${formatTime(slot.starts_at, timeZone)} para ${slot.serviceLabel}`} className="agenda-hour-row" key={slot.id ?? `${slot.service_id}-${slot.starts_at}`} onClick={() => onSelectSlot(slot)} type="button">
            <span className="agenda-hour-row-time"><Clock3 aria-hidden="true" size={15} />{formatTime(slot.starts_at, timeZone)}</span>
            <span className="min-w-0">
              <strong>Turno libre</strong>
              <small>{slot.serviceLabel} · {slot.remaining} de {slot.capacity} lugares</small>
            </span>
            <span className="status-badge status-confirmed">Disponible</span>
            <ChevronRight aria-hidden="true" className="text-ink-muted" size={17} />
          </button>
        ))}
      </div>
    ) : null}
  </Drawer>
  );
}

/** Lists the appointments of one crowded hour. */
export function AppointmentHoursDrawer({
  group,
  onClose,
  onSelectAppointment,
  timeZone,
}: {
  group: AppointmentHourGroup | null;
  onClose: () => void;
  onSelectAppointment: (id: string) => void;
  timeZone: string;
}) {
  return (
  <Drawer
    description={group ? `${formatInTimeZone(group.appointments[0].starts_at, timeZone, DAY_HEADER)} · ${formatHour(group.hour)}–${formatHour(group.hour + 1)}` : undefined}
    onClose={onClose}
    open={Boolean(group)}
    title={group ? `${group.appointments.length} turnos en esta hora` : "Turnos de esta hora"}
    width="medium"
  >
    {group ? (
      <div className="divide-y divide-line border-y border-line">
        {group.appointments.map((appointment) => (
          <button
            aria-label={`Abrir turno de ${appointment.clients?.name ?? "Cliente"} a las ${formatTime(appointment.starts_at, timeZone)}`}
            className="agenda-hour-row"
            key={appointment.id}
            onClick={() => onSelectAppointment(appointment.id)}
            type="button"
          >
            <span className="agenda-hour-row-time"><Clock3 aria-hidden="true" size={15} />{formatTime(appointment.starts_at, timeZone)}</span>
            <span className="min-w-0">
              <strong>{appointment.clients?.name ?? "Cliente"}</strong>
              <small>{appointment.services?.name ?? "Servicio"}</small>
            </span>
            <StatusBadge status={appointment.status} />
            <ChevronRight aria-hidden="true" className="text-ink-muted" size={17} />
          </button>
        ))}
      </div>
    ) : null}
  </Drawer>
  );
}

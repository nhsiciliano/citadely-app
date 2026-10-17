import { getSlotOccupancy, type Appointment, type Service, type ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { getMinutesOfDay, toDateKey, toTimeKey } from "@/lib/time";

// Pure layout and filtering rules of the Agenda screen (no React): hour range, grouping of busy and free
// hours, overlap lanes, and which appointments / free slots are visible for the selected days and filters.

export type CalendarView = "week" | "day";
export type AgendaFilters = { serviceId: string; status: "all" | "available" | Appointment["status"] };

export const DAY_HEADER = { weekday: "short", day: "numeric" } as const;
export const DATE_RANGE = { day: "numeric", month: "long", year: "numeric" } as const;
export const DEFAULT_START_HOUR = 10;
export const DEFAULT_END_HOUR = 18;
export const HOUR_HEIGHT = 68;
export const MIN_EVENT_HEIGHT = 44;
export const DENSE_HOUR_THRESHOLD = 3;

export type AppointmentHourGroup = {
  appointments: Appointment[];
  hour: number;
  key: string;
};

export type AppointmentLayout = {
  appointment: Appointment;
  height: number;
  lane: number;
  laneCount: number;
  top: number;
};

export type AvailableSlot = ServiceAvailabilitySlot & { serviceLabel: string; booked: number; remaining: number };

export type AvailableHourGroup = {
  hour: number;
  key: string;
  slots: AvailableSlot[];
};

export function getHourRange(services: Service[], availabilitySlots: ServiceAvailabilitySlot[], timeZone: string) {
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

export function isOnDay(value: string, dateKey: string, timeZone: string) {
  return toDateKey(value, timeZone) === dateKey;
}

export function formatHour(hour: number) {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function formatTime(value: string, timeZone: string) {
  return toTimeKey(value, timeZone);
}

export function getHourKey(value: string, hour: number, timeZone: string) {
  return `${toDateKey(value, timeZone)}-${hour}`;
}

export function getHour(value: string, timeZone: string) {
  return Math.floor(getMinutesOfDay(value, timeZone) / 60);
}

export function groupAppointmentsByHour(appointments: Appointment[], timeZone: string) {
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

export function groupAvailableSlotsByHour(slots: AvailableSlot[], timeZone: string) {
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

export function layoutAppointments(appointments: Appointment[], startHour: number, timeZone: string): AppointmentLayout[] {
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

export function summarizeServices(appointments: Appointment[]) {
  const services = [...new Set(appointments.map((appointment) => appointment.services?.name ?? "Servicio"))];
  if (services.length <= 2) return services.join(" · ");
  return `${services.slice(0, 2).join(" · ")} +${services.length - 2}`;
}


export function filterVisibleAppointments(
  appointments: Appointment[],
  { days, filters, timeZone }: { days: string[]; filters: AgendaFilters; timeZone: string },
) {
  return appointments.filter((appointment) => {
    if (filters.status === "available") return false;
    if (filters.serviceId !== "all" && appointment.service_id !== filters.serviceId) return false;
    if (filters.status !== "all" && appointment.status !== filters.status) return false;
    return days.some((day) => isOnDay(appointment.starts_at, day, timeZone));
  });
}

/** Free (bookable) slots in the selected days. With "all services" slots that start together collapse into one. */
export function computeVisibleAvailableSlots({
  appointments,
  availabilitySlots,
  days,
  filters,
  now,
  services,
  timeZone,
}: {
  appointments: Appointment[];
  availabilitySlots: ServiceAvailabilitySlot[];
  days: string[];
  filters: AgendaFilters;
  now: number;
  services: Service[];
  timeZone: string;
}): AvailableSlot[] {
  if (filters.status !== "available") return [];
  const activeServiceIds = new Set(services.filter((service) => service.is_active).map((service) => service.id));
  const freeSlots = availabilitySlots.flatMap((slot) => {
    if (!slot.is_active || !activeServiceIds.has(slot.service_id) || new Date(slot.starts_at).getTime() <= now) return [];
    if (filters.serviceId !== "all" && slot.service_id !== filters.serviceId) return [];
    if (!days.some((day) => isOnDay(slot.starts_at, day, timeZone))) return [];
    const occupancy = getSlotOccupancy(slot, appointments, now);
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
}

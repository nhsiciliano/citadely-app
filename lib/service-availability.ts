import type { ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { addMonthsToMonthKey, formatDateKey, getDaysInMonth, getWeekdayOfDateKey, toDateKey, toMonthKey, toTimeKey, zonedTimeToUtc } from "@/lib/time";

// Pure rules of the service availability editor: the six editable months, the month grid, the
// {day: {time: capacity}} draft and the slots it turns into.

export function monthDays(value: string) {
  const leading = (getWeekdayOfDateKey(`${value}-01`) + 6) % 7;
  return [
    ...Array.from({ length: leading }, (_, index) => ({ blank: true as const, key: `blank-${index}` })),
    ...Array.from({ length: getDaysInMonth(value) }, (_, index) => {
      const key = `${value}-${String(index + 1).padStart(2, "0")}`;
      return { blank: false as const, key, day: index + 1, weekday: formatDateKey(key, { weekday: "short" }) };
    }),
  ];
}

export function monthOptions(timeZone: string) {
  const currentMonth = toMonthKey(new Date(), timeZone);
  return Array.from({ length: 6 }, (_, index) => {
    const key = addMonthsToMonthKey(currentMonth, index);
    return { key, label: formatDateKey(`${key}-01`, { month: "long", year: "numeric" }) };
  });
}

export function slotCount(slots: ServiceAvailabilitySlot[], serviceId: string, value: string, timeZone: string) {
  return slots.filter((slot) => slot.service_id === serviceId && slot.is_active && toMonthKey(slot.starts_at, timeZone) === value).length;
}

export function currencyInputValue(cents: number) {
  return String(cents / 100);
}


export type DateTimes = Record<string, Record<string, number>>;

export type MonthOption = ReturnType<typeof monthOptions>[number];

/** Draft of the active slots of one service inside the editable months, keyed by local day and time. */
export function buildDateTimes(slots: ServiceAvailabilitySlot[], serviceId: string, options: MonthOption[], timeZone: string): DateTimes {
  const editableMonths = new Set(options.map((option) => option.key));
  return slots.reduce<DateTimes>((result, slot) => {
    if (slot.service_id !== serviceId || !slot.is_active || !editableMonths.has(toMonthKey(slot.starts_at, timeZone))) return result;
    const day = toDateKey(slot.starts_at, timeZone);
    result[day] = { ...(result[day] ?? {}), [toTimeKey(slot.starts_at, timeZone)]: slot.capacity ?? 1 };
    return result;
  }, {});
}

export function requestedSlots(dateTimes: DateTimes, timeZone: string) {
  return Object.entries(dateTimes).flatMap(([day, times]) => Object.entries(times).map(([time, capacity]) => ({
    startsAt: zonedTimeToUtc(day, time, timeZone),
    capacity,
  })));
}

export function validateSlots(slots: ReturnType<typeof requestedSlots>) {
  if (!slots.length) return "Agregá al menos un día y horario para publicar este servicio.";
  if (slots.some((slot) => !Number.isInteger(slot.capacity) || slot.capacity < 1 || slot.capacity > 1000)) {
    return "El cupo de cada horario debe estar entre 1 y 1000 personas.";
  }
  return null;
}

/** From the first day of the first month to the end of the last month of the selector. */
export function getEditableWindow(options: MonthOption[], timeZone: string) {
  return {
    start: zonedTimeToUtc(`${options[0].key}-01`, "00:00", timeZone),
    end: zonedTimeToUtc(`${addMonthsToMonthKey(options[options.length - 1].key, 1)}-01`, "00:00", timeZone),
  };
}

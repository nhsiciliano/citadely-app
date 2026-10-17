// Business-time helpers. Every wall-clock value (day, hour, "today") is read in the
// business time zone, never in the browser or server zone. Calendar keys are plain
// strings: dateKey "YYYY-MM-DD", monthKey "YYYY-MM", timeKey "HH:mm".

export const DEFAULT_TIME_ZONE = "America/Argentina/Buenos_Aires";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_KEY_PATTERN = /^(\d{4})-(\d{2})$/;
const TIME_KEY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const validTimeZones = new Map<string, boolean>();
const formatters = new Map<string, Intl.DateTimeFormat>();

export type ZonedDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function resolveTimeZone(timeZone: string | null | undefined) {
  if (!timeZone) return DEFAULT_TIME_ZONE;
  let valid = validTimeZones.get(timeZone);
  if (valid === undefined) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone });
      valid = true;
    } catch {
      valid = false;
    }
    validTimeZones.set(timeZone, valid);
  }
  return valid ? timeZone : DEFAULT_TIME_ZONE;
}

function getFormatter(locale: string, options: Intl.DateTimeFormatOptions) {
  const key = `${locale}|${JSON.stringify(options)}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, options);
    formatters.set(key, formatter);
  }
  return formatter;
}

function toDate(value: Date | string | number) {
  return value instanceof Date ? value : new Date(value);
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatInTimeZone(
  value: Date | string | number,
  timeZone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
  locale = "es-AR",
) {
  return getFormatter(locale, { ...options, timeZone: resolveTimeZone(timeZone) }).format(toDate(value));
}

export function getZonedDateParts(value: Date | string | number, timeZone: string | null | undefined): ZonedDateParts {
  const parts = getFormatter("en-US", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(toDate(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getTimeZoneOffsetMs(instant: number, timeZone: string) {
  const parts = getZonedDateParts(instant, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

export function parseDateKey(dateKey: string) {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) throw new RangeError(`Invalid date key: ${dateKey}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    throw new RangeError(`Invalid date key: ${dateKey}`);
  }
  return { year, month, day };
}

function parseMonthKey(monthKey: string) {
  const match = MONTH_KEY_PATTERN.exec(monthKey);
  const month = match ? Number(match[2]) : 0;
  if (!match || month < 1 || month > 12) throw new RangeError(`Invalid month key: ${monthKey}`);
  return { year: Number(match[1]), month };
}

function parseTimeKey(time: string) {
  const match = TIME_KEY_PATTERN.exec(time);
  if (!match) throw new RangeError(`Invalid time: ${time}`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

/** UTC instant for a wall-clock date and time in the given zone. Nonexistent DST times move forward. */
export function zonedTimeToUtc(dateKey: string, time: string, timeZone: string | null | undefined) {
  const zone = resolveTimeZone(timeZone);
  const { year, month, day } = parseDateKey(dateKey);
  const { hour, minute } = parseTimeKey(time);
  const wallClock = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = getTimeZoneOffsetMs(wallClock, zone);
  let instant = wallClock - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(instant, zone);
  if (secondOffset !== firstOffset) {
    const retry = wallClock - secondOffset;
    instant = getTimeZoneOffsetMs(retry, zone) === secondOffset ? retry : Math.max(instant, retry);
  }
  return new Date(instant);
}

export function toDateKey(value: Date | string | number, timeZone: string | null | undefined) {
  const { year, month, day } = getZonedDateParts(value, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function toMonthKey(value: Date | string | number, timeZone: string | null | undefined) {
  return toDateKey(value, timeZone).slice(0, 7);
}

export function toTimeKey(value: Date | string | number, timeZone: string | null | undefined) {
  const { hour, minute } = getZonedDateParts(value, timeZone);
  return `${pad(hour)}:${pad(minute)}`;
}

export function getMinutesOfDay(value: Date | string | number, timeZone: string | null | undefined) {
  const { hour, minute } = getZonedDateParts(value, timeZone);
  return hour * 60 + minute;
}

export function isSameDayInTimeZone(left: Date | string | number, right: Date | string | number, timeZone: string | null | undefined) {
  return toDateKey(left, timeZone) === toDateKey(right, timeZone);
}

/** UTC instant of 00:00 of the given day (a dateKey or an instant) in the zone. */
export function startOfDayInTimeZone(value: Date | string | number, timeZone: string | null | undefined) {
  const dateKey = typeof value === "string" && DATE_KEY_PATTERN.test(value) ? value : toDateKey(value, timeZone);
  return zonedTimeToUtc(dateKey, "00:00", timeZone);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const { year, month, day } = parseDateKey(dateKey);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addMonthsToMonthKey(monthKey: string, months: number) {
  const { year, month } = parseMonthKey(monthKey);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

/** 0 = Sunday … 6 = Saturday, like Date#getDay. */
export function getWeekdayOfDateKey(dateKey: string) {
  const { year, month, day } = parseDateKey(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** Monday of the week that contains dateKey. */
export function startOfWeekDateKey(dateKey: string) {
  return addDaysToDateKey(dateKey, -((getWeekdayOfDateKey(dateKey) + 6) % 7));
}

export function getDaysInMonth(monthKey: string) {
  const { year, month } = parseMonthKey(monthKey);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Formats a calendar day (no time of day), independent of any zone. */
export function formatDateKey(dateKey: string, options: Intl.DateTimeFormatOptions, locale = "es-AR") {
  const { year, month, day } = parseDateKey(dateKey);
  return getFormatter(locale, { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

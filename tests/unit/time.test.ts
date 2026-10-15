import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  addMonthsToMonthKey,
  DEFAULT_TIME_ZONE,
  formatDateKey,
  formatInTimeZone,
  getDaysInMonth,
  getMinutesOfDay,
  getWeekdayOfDateKey,
  getZonedDateParts,
  isSameDayInTimeZone,
  parseDateKey,
  resolveTimeZone,
  startOfDayInTimeZone,
  startOfWeekDateKey,
  toDateKey,
  toMonthKey,
  toTimeKey,
  zonedTimeToUtc,
} from "../../lib/time";

const AR = "America/Argentina/Buenos_Aires";
const NY = "America/New_York";
const MADRID = "Europe/Madrid";

describe("resolveTimeZone", () => {
  it("keeps valid IANA zones", () => {
    expect(resolveTimeZone(NY)).toBe(NY);
    expect(resolveTimeZone("UTC")).toBe("UTC");
  });

  it("falls back to the default zone for empty or invalid values", () => {
    expect(resolveTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone(undefined)).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone("")).toBe(DEFAULT_TIME_ZONE);
    expect(resolveTimeZone("Mars/Olympus_Mons")).toBe(DEFAULT_TIME_ZONE);
  });
});

describe("zonedTimeToUtc", () => {
  it("reads the wall clock in the business zone, not the runtime zone", () => {
    expect(zonedTimeToUtc("2026-10-15", "10:00", AR).toISOString()).toBe("2026-10-15T13:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-15", "10:00", "UTC").toISOString()).toBe("2026-10-15T10:00:00.000Z");
    expect(zonedTimeToUtc("2026-10-15", "10:00", MADRID).toISOString()).toBe("2026-10-15T08:00:00.000Z");
  });

  it("crosses into the next UTC day for late local times", () => {
    expect(zonedTimeToUtc("2026-12-31", "23:30", AR).toISOString()).toBe("2027-01-01T02:30:00.000Z");
  });

  it("uses the offset in effect on that date across DST changes", () => {
    expect(zonedTimeToUtc("2026-03-07", "10:00", NY).toISOString()).toBe("2026-03-07T15:00:00.000Z");
    expect(zonedTimeToUtc("2026-03-08", "10:00", NY).toISOString()).toBe("2026-03-08T14:00:00.000Z");
    expect(zonedTimeToUtc("2026-03-08", "03:30", NY).toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(zonedTimeToUtc("2026-11-01", "10:00", NY).toISOString()).toBe("2026-11-01T15:00:00.000Z");
  });

  it("moves nonexistent DST-gap times forward and picks the first of repeated times", () => {
    expect(toTimeKey(zonedTimeToUtc("2026-03-08", "02:30", NY), NY)).toBe("03:30");
    expect(zonedTimeToUtc("2026-11-01", "01:30", NY).toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("round-trips with toDateKey and toTimeKey", () => {
    for (const zone of [AR, NY, MADRID, "Asia/Kolkata", "Pacific/Auckland"]) {
      const instant = zonedTimeToUtc("2026-07-04", "09:45", zone);
      expect(toDateKey(instant, zone)).toBe("2026-07-04");
      expect(toTimeKey(instant, zone)).toBe("09:45");
    }
  });

  it("rejects malformed input", () => {
    expect(() => zonedTimeToUtc("2026-02-30", "10:00", AR)).toThrow(RangeError);
    expect(() => zonedTimeToUtc("15/10/2026", "10:00", AR)).toThrow(RangeError);
    expect(() => zonedTimeToUtc("2026-10-15", "24:00", AR)).toThrow(RangeError);
    expect(() => zonedTimeToUtc("2026-10-15", "9:00", AR)).toThrow(RangeError);
  });
});

describe("keys and parts in a zone", () => {
  const instant = new Date("2026-10-16T02:30:00.000Z");

  it("returns the business-local day, month and time", () => {
    expect(toDateKey(instant, AR)).toBe("2026-10-15");
    expect(toDateKey(instant, "UTC")).toBe("2026-10-16");
    expect(toMonthKey(new Date("2026-11-01T01:00:00.000Z"), AR)).toBe("2026-10");
    expect(toTimeKey(instant, AR)).toBe("23:30");
    expect(getMinutesOfDay(instant, AR)).toBe(23 * 60 + 30);
  });

  it("reports midnight as hour 0", () => {
    expect(getZonedDateParts(new Date("2026-10-15T03:00:00.000Z"), AR)).toEqual({ year: 2026, month: 10, day: 15, hour: 0, minute: 0, second: 0 });
  });

  it("accepts ISO strings and timestamps", () => {
    expect(toDateKey("2026-10-16T02:30:00.000Z", AR)).toBe("2026-10-15");
    expect(toDateKey(instant.getTime(), AR)).toBe("2026-10-15");
  });

  it("compares days in the business zone", () => {
    expect(isSameDayInTimeZone("2026-10-15T12:00:00.000Z", "2026-10-16T02:59:00.000Z", AR)).toBe(true);
    expect(isSameDayInTimeZone("2026-10-15T12:00:00.000Z", "2026-10-16T03:00:00.000Z", AR)).toBe(false);
  });

  it("finds the start of the business day", () => {
    expect(startOfDayInTimeZone(instant, AR).toISOString()).toBe("2026-10-15T03:00:00.000Z");
    expect(startOfDayInTimeZone("2026-10-15", AR).toISOString()).toBe("2026-10-15T03:00:00.000Z");
    expect(startOfDayInTimeZone("2026-03-08", NY).toISOString()).toBe("2026-03-08T05:00:00.000Z");
  });
});

describe("calendar arithmetic", () => {
  it("parses date keys", () => {
    expect(parseDateKey("2028-02-29")).toEqual({ year: 2028, month: 2, day: 29 });
    expect(() => parseDateKey("2026-02-29")).toThrow(RangeError);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysToDateKey("2026-10-15", 7)).toBe("2026-10-22");
  });

  it("adds months", () => {
    expect(addMonthsToMonthKey("2026-11", 2)).toBe("2027-01");
    expect(addMonthsToMonthKey("2026-01", -1)).toBe("2025-12");
  });

  it("computes weekdays and Monday-based week starts", () => {
    expect(getWeekdayOfDateKey("2026-10-15")).toBe(4);
    expect(getWeekdayOfDateKey("2026-10-18")).toBe(0);
    expect(startOfWeekDateKey("2026-10-15")).toBe("2026-10-12");
    expect(startOfWeekDateKey("2026-10-18")).toBe("2026-10-12");
    expect(startOfWeekDateKey("2026-10-12")).toBe("2026-10-12");
    expect(startOfWeekDateKey("2027-01-01")).toBe("2026-12-28");
  });

  it("counts days in a month", () => {
    expect(getDaysInMonth("2026-02")).toBe(28);
    expect(getDaysInMonth("2028-02")).toBe(29);
    expect(getDaysInMonth("2026-10")).toBe(31);
  });
});

describe("formatting", () => {
  it("formats instants in the business zone", () => {
    const options = { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } as const;
    expect(formatInTimeZone("2026-10-15T13:00:00.000Z", AR, options)).toBe("10:00");
    expect(formatInTimeZone("2026-10-15T13:00:00.000Z", MADRID, options)).toBe("15:00");
  });

  it("formats calendar days without shifting them", () => {
    expect(formatDateKey("2026-10-15", { weekday: "long", day: "numeric", month: "long" })).toBe("jueves, 15 de octubre");
    expect(formatDateKey("2026-01-01", { day: "numeric", month: "numeric", year: "numeric" })).toBe("1/1/2026");
  });
});

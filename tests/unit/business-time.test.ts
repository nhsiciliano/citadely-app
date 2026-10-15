import { describe, expect, it } from "vitest";
import { buildBookingSlots, calculateStats, type Appointment, type Service, type ServiceAvailabilitySlot } from "@/lib/citadely-db";
import { getPublicAvailabilitySummary } from "@/lib/public-profile";
import { zonedTimeToUtc } from "@/lib/time";

const AR = "America/Argentina/Buenos_Aires";
const MADRID = "Europe/Madrid";

const service: Service = {
  id: "service-1",
  business_id: "business-1",
  name: "Corte",
  description: null,
  image_url: null,
  duration_minutes: 60,
  price_cents: 1_000_000,
  requires_payment: false,
  deposit_type: "free",
  deposit_value_cents: 0,
  is_active: true,
};

function slotAt(dateKey: string, time: string, timeZone: string): ServiceAvailabilitySlot {
  const startsAt = zonedTimeToUtc(dateKey, time, timeZone);
  return {
    id: `${dateKey}-${time}`,
    business_id: "business-1",
    service_id: service.id,
    starts_at: startsAt.toISOString(),
    ends_at: new Date(startsAt.getTime() + 60 * 60000).toISOString(),
    is_active: true,
    capacity: 1,
  };
}

function appointmentAt(iso: string, status: Appointment["status"] = "confirmed"): Appointment {
  return {
    id: iso,
    business_id: "business-1",
    client_id: "client-1",
    service_id: service.id,
    employee_id: null,
    starts_at: iso,
    ends_at: new Date(new Date(iso).getTime() + 60 * 60000).toISOString(),
    status,
    source: "business",
    client_message: null,
    deposit_amount_cents: 0,
    deposit_expires_at: null,
    deposit_confirmed_at: null,
    deposit_confirmed_by: null,
  };
}

describe("buildBookingSlots", () => {
  it("labels slots in the business zone", () => {
    const slots = buildBookingSlots([], service, [slotAt("2099-03-10", "23:30", AR)], AR);
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ dateKey: "2099-03-10", timeLabel: "23:30", available: true });
    expect(slots[0].startsAt).toBe("2099-03-11T02:30:00.000Z");
  });

  it("follows each business zone", () => {
    const [slot] = buildBookingSlots([], service, [slotAt("2099-03-10", "10:00", MADRID)], MADRID);
    expect(slot).toMatchObject({ dateKey: "2099-03-10", timeLabel: "10:00" });
  });
});

describe("getPublicAvailabilitySummary", () => {
  it("summarizes weekdays and hours in the business zone", () => {
    // 2099-03-10 is a Tuesday; 23:30 in Buenos Aires is already Wednesday in UTC.
    const summary = getPublicAvailabilitySummary([slotAt("2099-03-10", "09:00", AR), slotAt("2099-03-10", "23:30", AR)], [], AR);
    expect(summary).toEqual({ dateCount: 1, schedule: "mar · 09:00–23:30" });
  });
});

describe("calculateStats", () => {
  // 2026-10-15 21:30 in Buenos Aires (2026-10-16 00:30 UTC).
  const now = new Date("2026-10-16T00:30:00.000Z");

  it("counts today and the current month in the business zone", () => {
    const appointments = [
      appointmentAt("2026-10-15T12:00:00.000Z"),
      appointmentAt("2026-10-16T01:30:00.000Z"),
      appointmentAt("2026-10-16T03:30:00.000Z"),
      appointmentAt("2026-10-01T02:00:00.000Z"),
      appointmentAt("2026-10-15T15:00:00.000Z", "cancelled"),
    ];
    const stats = calculateStats(appointments, [service], AR, now);
    expect(stats.todayAppointments).toBe(2);
    expect(stats.upcomingAppointments).toBe(2);
    expect(stats.monthlyRevenueCents).toBe(3 * service.price_cents);
    expect(stats.occupancy).toBe(25);
  });
});

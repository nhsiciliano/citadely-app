import { describe, expect, it } from "vitest";
import { buildDateTimes, getEditableWindow, monthDays, monthOptions, requestedSlots, slotCount, validateSlots } from "@/lib/service-availability";
import type { ServiceAvailabilitySlot } from "@/lib/citadely-db";

const TZ = "America/Argentina/Buenos_Aires";
const slot = (serviceId: string, start: string, capacity = 2, active = true) =>
  ({ id: `${serviceId}-${start}`, service_id: serviceId, starts_at: start, ends_at: start, is_active: active, capacity }) as unknown as ServiceAvailabilitySlot;

describe("monthDays", () => {
  it("empieza en lunes: octubre 2026 arranca jueves => 3 vacíos y 31 días", () => {
    const days = monthDays("2026-10");
    expect(days.filter((day) => day.blank)).toHaveLength(3);
    expect(days.filter((day) => !day.blank)).toHaveLength(31);
  });
});

describe("monthOptions / getEditableWindow", () => {
  it("ofrece seis meses consecutivos y una ventana que los cubre completos", () => {
    const options = monthOptions(TZ);
    expect(options).toHaveLength(6);
    const window = getEditableWindow(options, TZ);
    expect(window.end.getTime()).toBeGreaterThan(window.start.getTime());
    const days = (window.end.getTime() - window.start.getTime()) / 86400000;
    expect(days).toBeGreaterThan(5 * 28);
    expect(days).toBeLessThan(6 * 32);
  });
});

describe("buildDateTimes / requestedSlots / validateSlots", () => {
  const options = [{ key: "2026-10", label: "octubre" }, { key: "2026-11", label: "noviembre" }];

  it("arma el borrador día/hora/cupo solo con horarios activos de ese servicio dentro de los meses editables", () => {
    const slots = [
      slot("a", "2026-10-20T12:00:00.000Z", 3),
      slot("a", "2026-10-20T15:30:00.000Z", 1),
      slot("a", "2026-12-01T12:00:00.000Z"), // fuera de los meses editables
      slot("a", "2026-10-21T12:00:00.000Z", 1, false), // inactivo
      slot("b", "2026-10-20T12:00:00.000Z"), // otro servicio
    ];
    expect(buildDateTimes(slots, "a", options, TZ)).toEqual({ "2026-10-20": { "09:00": 3, "12:30": 1 } });
  });

  it("convierte el borrador a instantes UTC y valida cupos", () => {
    const requested = requestedSlots({ "2026-10-20": { "09:00": 3 } }, TZ);
    expect(requested).toEqual([{ startsAt: new Date("2026-10-20T12:00:00.000Z"), capacity: 3 }]);
    expect(validateSlots(requested)).toBeNull();
    expect(validateSlots([])).toMatch(/al menos un día/);
    expect(validateSlots([{ startsAt: new Date(), capacity: 0 }])).toMatch(/entre 1 y 1000/);
    expect(validateSlots([{ startsAt: new Date(), capacity: 1001 }])).toMatch(/entre 1 y 1000/);
    expect(validateSlots([{ startsAt: new Date(), capacity: 1.5 }])).toMatch(/entre 1 y 1000/);
  });

  it("cuenta los horarios activos de un servicio en un mes", () => {
    const slots = [slot("a", "2026-10-20T12:00:00.000Z"), slot("a", "2026-11-02T12:00:00.000Z"), slot("a", "2026-10-22T12:00:00.000Z", 1, false)];
    expect(slotCount(slots, "a", "2026-10", TZ)).toBe(1);
  });
});

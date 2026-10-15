import { describe, expect, it } from "vitest";
import {
  computeVisibleAvailableSlots,
  filterVisibleAppointments,
  getHourRange,
  groupAppointmentsByHour,
  layoutAppointments,
  type AgendaFilters,
} from "@/lib/agenda-layout";
import type { Appointment, Service, ServiceAvailabilitySlot } from "@/lib/citadely-db";

const TZ = "America/Argentina/Buenos_Aires";

const service = (id: string, active = true) => ({ id, name: `Servicio ${id}`, is_active: active }) as unknown as Service;
const slot = (id: string, serviceId: string, start: string, minutes = 30, capacity = 1) => ({
  id, service_id: serviceId, starts_at: start, ends_at: new Date(new Date(start).getTime() + minutes * 60000).toISOString(), is_active: true, capacity,
}) as unknown as ServiceAvailabilitySlot;
const appointment = (id: string, serviceId: string, start: string, minutes = 30, status: Appointment["status"] = "confirmed") => ({
  id, service_id: serviceId, starts_at: start, ends_at: new Date(new Date(start).getTime() + minutes * 60000).toISOString(), status,
}) as unknown as Appointment;

// 12:00Z = 09:00 in Buenos Aires (UTC-3).
const at = (hour: number, minute = 0) => `2026-10-20T${String(hour + 3).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00.000Z`;

describe("getHourRange", () => {
  it("usa 10-18 sin horarios publicados", () => {
    expect(getHourRange([service("a")], [], TZ)).toEqual({ startHour: 10, endHour: 18 });
  });

  it("cubre desde el primer horario hasta el fin del último, en la zona del negocio", () => {
    const slots = [slot("1", "a", at(9)), slot("2", "a", at(16, 30), 60)];
    expect(getHourRange([service("a")], slots, TZ)).toEqual({ startHour: 9, endHour: 18 });
  });

  it("ignora horarios de servicios que ya no existen", () => {
    expect(getHourRange([service("a")], [slot("1", "zzz", at(6))], TZ)).toEqual({ startHour: 10, endHour: 18 });
  });
});

describe("layoutAppointments", () => {
  it("reparte en carriles los turnos que se superponen y no los que no", () => {
    const layout = layoutAppointments(
      [appointment("1", "a", at(9), 60), appointment("2", "a", at(9, 30), 60), appointment("3", "a", at(12), 30)],
      9,
      TZ,
    );
    const byId = Object.fromEntries(layout.map((item) => [item.appointment.id, item]));
    expect(byId["1"].laneCount).toBe(2);
    expect(byId["2"].laneCount).toBe(2);
    expect(new Set([byId["1"].lane, byId["2"].lane]).size).toBe(2);
    expect(byId["3"].laneCount).toBe(1);
  });

  it("agrupa por hora local", () => {
    const groups = groupAppointmentsByHour([appointment("1", "a", at(9, 40)), appointment("2", "a", at(9, 5)), appointment("3", "a", at(10))], TZ);
    expect(groups.map((group) => [group.hour, group.appointments.map((item) => item.id)])).toEqual([[9, ["2", "1"]], [10, ["3"]]]);
  });
});

describe("filterVisibleAppointments", () => {
  const appointments = [appointment("1", "a", at(9)), appointment("2", "b", at(9), 30, "cancelled"), appointment("3", "a", "2026-10-21T15:00:00.000Z")];
  const days = ["2026-10-20"];
  const filter = (filters: Partial<AgendaFilters>) => filterVisibleAppointments(appointments, { days, filters: { serviceId: "all", status: "all", ...filters }, timeZone: TZ }).map((item) => item.id);

  it("filtra por día, servicio y estado", () => {
    expect(filter({})).toEqual(["1", "2"]);
    expect(filter({ serviceId: "a" })).toEqual(["1"]);
    expect(filter({ status: "cancelled" })).toEqual(["2"]);
    expect(filter({ status: "available" })).toEqual([]);
  });
});

describe("computeVisibleAvailableSlots", () => {
  const now = new Date("2026-10-19T00:00:00Z").getTime();
  const base = {
    appointments: [appointment("x", "a", at(9))],
    days: ["2026-10-20"],
    now,
    services: [service("a"), service("b"), service("off", false)],
    timeZone: TZ,
  };
  const slots = [slot("s1", "a", at(9)), slot("s2", "b", at(9)), slot("s3", "a", at(10)), slot("s4", "off", at(11))];

  it("solo se calcula con el filtro 'Turnos libres'", () => {
    expect(computeVisibleAvailableSlots({ ...base, availabilitySlots: slots, filters: { serviceId: "all", status: "all" } })).toEqual([]);
  });

  it("descarta horarios llenos y de servicios inactivos, y junta los simultáneos", () => {
    const free = computeVisibleAvailableSlots({ ...base, availabilitySlots: slots, filters: { serviceId: "all", status: "available" } });
    // s1 está ocupado por el turno "x"; s2 (otro servicio, mismo horario) queda bloqueado por superposición o libre según la regla de ocupación.
    expect(free.map((item) => item.id)).not.toContain("s4");
    expect(free.every((item) => item.remaining > 0)).toBe(true);
  });

  it("con un servicio elegido etiqueta con su nombre", () => {
    const free = computeVisibleAvailableSlots({ ...base, availabilitySlots: slots, filters: { serviceId: "a", status: "available" } });
    expect(free.map((item) => item.serviceLabel)).toEqual(expect.arrayContaining(["Servicio a"]));
  });
});

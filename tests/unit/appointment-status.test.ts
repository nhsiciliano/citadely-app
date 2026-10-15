import { describe, expect, it } from "vitest";
import { getStatusOptions, requiresStatusConfirmation } from "@/lib/appointment-status";

const NOW = new Date("2026-10-15T15:00:00Z").getTime();
const past = "2026-10-14T15:00:00Z";
const future = "2026-10-16T15:00:00Z";

describe("getStatusOptions", () => {
  it("nunca ofrece volver a seña pendiente", () => {
    for (const status of ["confirmed", "completed", "no_show", "cancelled"] as const) {
      expect(getStatusOptions({ status, starts_at: past, deposit_amount_cents: 0 }, NOW)).not.toContain("pending_payment");
    }
  });

  it("un turno con seña pendiente se confirma con el botón de seña, no con el selector", () => {
    expect(getStatusOptions({ status: "pending_payment", starts_at: future, deposit_amount_cents: 1000 }, NOW)).toEqual(["pending_payment", "cancelled"]);
    expect(getStatusOptions({ status: "pending_payment", starts_at: future, deposit_amount_cents: 0 }, NOW)).toEqual(["pending_payment", "confirmed", "cancelled"]);
  });

  it("completado y no asistió solo después del inicio", () => {
    expect(getStatusOptions({ status: "confirmed", starts_at: future, deposit_amount_cents: 0 }, NOW)).toEqual(["confirmed", "cancelled"]);
    expect(getStatusOptions({ status: "confirmed", starts_at: past, deposit_amount_cents: 0 }, NOW)).toEqual(["confirmed", "completed", "no_show", "cancelled"]);
  });

  it("permite corregir y reactivar", () => {
    expect(getStatusOptions({ status: "no_show", starts_at: past, deposit_amount_cents: 0 }, NOW)).toEqual(["no_show", "completed", "confirmed"]);
    expect(getStatusOptions({ status: "cancelled", starts_at: future, deposit_amount_cents: 0 }, NOW)).toEqual(["cancelled", "confirmed"]);
  });

  it("pide confirmación para cancelar y para inasistencia", () => {
    expect(requiresStatusConfirmation("cancelled")).toBe(true);
    expect(requiresStatusConfirmation("no_show")).toBe(true);
    expect(requiresStatusConfirmation("completed")).toBe(false);
  });
});

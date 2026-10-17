import { describe, expect, it } from "vitest";
import { GENERIC_BOOKING_ERROR, getPublicBookingErrorMessage } from "@/lib/booking-errors";

describe("getPublicBookingErrorMessage", () => {
  it("deja pasar los mensajes pensados para el cliente", () => {
    expect(getPublicBookingErrorMessage("El horario ya no tiene cupos disponibles")).toBe("El horario ya no tiene cupos disponibles");
  });

  it("no expone errores internos de la base de datos", () => {
    expect(getPublicBookingErrorMessage('duplicate key value violates unique constraint "x"')).toBeNull();
    expect(getPublicBookingErrorMessage(undefined)).toBeNull();
    expect(GENERIC_BOOKING_ERROR).toMatch(/Probá de nuevo/);
  });
});

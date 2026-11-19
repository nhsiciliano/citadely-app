import { describe, expect, it } from "vitest";
import { getBusinessInitials } from "@/lib/business-initials";

describe("getBusinessInitials", () => {
  it("usa las iniciales de las dos primeras palabras", () => {
    expect(getBusinessInitials("Centro Aura")).toBe("CA");
    expect(getBusinessInitials("Odontología Migliore Asociados")).toBe("OM");
    expect(getBusinessInitials("  barbería   luk ")).toBe("BL");
  });

  it("saltea conectores", () => {
    expect(getBusinessInitials("Clínica de la Colón")).toBe("CC");
    expect(getBusinessInitials("La Barbería del Centro")).toBe("BC");
    expect(getBusinessInitials("Uñas y Pestañas")).toBe("UP");
    expect(getBusinessInitials("Pilates & Yoga")).toBe("PY");
  });

  it("con una sola palabra toma sus dos primeras letras", () => {
    expect(getBusinessInitials("Aura")).toBe("AU");
    expect(getBusinessInitials("ñandú")).toBe("ÑA");
  });

  it("ignora signos y conserva acentos", () => {
    expect(getBusinessInitials("«Éxito» Estudio")).toBe("ÉE");
    expect(getBusinessInitials("Estudio - 360")).toBe("E3");
  });

  it("si todo son conectores, los usa igual", () => {
    expect(getBusinessInitials("La Y")).toBe("LY");
  });

  it("devuelve vacío sin caracteres alfanuméricos", () => {
    expect(getBusinessInitials("")).toBe("");
    expect(getBusinessInitials(" - ")).toBe("");
  });
});

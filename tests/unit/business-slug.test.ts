import { describe, expect, it } from "vitest";
import { getBusinessCategoryOptions } from "@/lib/business-categories";
import { RESERVED_BUSINESS_SLUGS, validateBusinessSlug } from "@/lib/business-slug";

describe("validateBusinessSlug", () => {
  it("acepta slugs válidos", () => {
    expect(validateBusinessSlug("barberia-norte")).toBeNull();
    expect(validateBusinessSlug("abc")).toBeNull();
  });

  it("rechaza largo, formato y palabras reservadas", () => {
    expect(validateBusinessSlug("ab")).toMatch(/al menos 3/);
    expect(validateBusinessSlug("a".repeat(61))).toMatch(/hasta 60/);
    for (const bad of ["Mayus", "con espacio", "doble--guion", "-inicio", "fin-", "ñandú"]) {
      expect(validateBusinessSlug(bad), bad).toMatch(/minúsculas/);
    }
    for (const reserved of ["www", "admin", "api", "app", "negocio"]) {
      expect(RESERVED_BUSINESS_SLUGS.has(reserved)).toBe(true);
      expect(validateBusinessSlug(reserved)).toMatch(/reservada/);
    }
  });
});

describe("getBusinessCategoryOptions", () => {
  it("lista los rubros de PRODUCT.md y conserva un valor heredado", () => {
    const base = getBusinessCategoryOptions();
    expect(base.map((option) => option.value)).toContain("consultorio_clinico");
    expect(base.map((option) => option.value)).toContain("otros");
    const legacy = getBusinessCategoryOptions("barberia");
    expect(legacy.at(-1)).toEqual({ value: "barberia", label: "Barbería / peluquería" });
    expect(getBusinessCategoryOptions("gimnasio")).toHaveLength(base.length);
  });
});

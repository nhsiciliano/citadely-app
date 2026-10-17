import { describe, expect, it } from "vitest";
import { parseMoneyToCents, readServiceForm } from "@/lib/service-form";

function form(values: Record<string, string>) {
  const data = new FormData();
  const defaults = { name: "Consulta", description: "", image_url: "", duration_minutes: "30", price: "1000", deposit_type: "free", deposit_value: "0" };
  for (const [key, value] of Object.entries({ ...defaults, ...values })) data.set(key, value);
  return data;
}

describe("parseMoneyToCents", () => {
  it("acepta enteros y hasta dos decimales con punto o coma", () => {
    expect(parseMoneyToCents("1500")).toBe(150000);
    expect(parseMoneyToCents("1500,5")).toBe(150050);
    expect(parseMoneyToCents(" 0.99 ")).toBe(99);
  });

  it("rechaza vacío, negativos, tres decimales y texto", () => {
    for (const bad of ["", "-1", "1.234", "abc", "1e3", null]) expect(parseMoneyToCents(bad), String(bad)).toBeNull();
  });
});

describe("readServiceForm", () => {
  it("lee un servicio gratuito válido", () => {
    const result = readServiceForm(form({}));
    expect(result.error).toBeNull();
    expect(result.input).toMatchObject({ name: "Consulta", durationMinutes: 30, priceCents: 100000, depositType: "free", depositValueCents: 0 });
  });

  it("la seña del 100% usa el precio y la seña configurable se valida contra el precio", () => {
    expect(readServiceForm(form({ deposit_type: "full" })).input?.depositValueCents).toBe(100000);
    expect(readServiceForm(form({ deposit_type: "deposit", deposit_value: "250" })).input?.depositValueCents).toBe(25000);
    expect(readServiceForm(form({ deposit_type: "deposit", deposit_value: "1500" })).error).toMatch(/no puede superar/);
    expect(readServiceForm(form({ deposit_type: "deposit", deposit_value: "0" })).error).toMatch(/seña/);
  });

  it("valida nombre, duración y precio", () => {
    expect(readServiceForm(form({ name: "  " })).error).toMatch(/nombre/);
    expect(readServiceForm(form({ duration_minutes: "0" })).error).toMatch(/duración/);
    expect(readServiceForm(form({ duration_minutes: "1.5" })).error).toMatch(/duración/);
    expect(readServiceForm(form({ duration_minutes: "1441" })).error).toMatch(/duración/);
    expect(readServiceForm(form({ price: "-5" })).error).toMatch(/precio/);
    expect(readServiceForm(form({ price: "0", deposit_type: "full" })).error).toMatch(/mayor a cero/);
  });
});

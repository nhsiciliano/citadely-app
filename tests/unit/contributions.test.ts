import { describe, expect, it } from "vitest";
import {
  CONTRIBUTION_MAX_CENTS,
  CONTRIBUTION_MIN_CENTS,
  contributionStatusLabel,
  formatArs,
  parseContributionAmount,
  parseContributionReturnResult,
  type ContributionOption,
} from "@/lib/contributions";

const OPTIONS: ContributionOption[] = [
  { code: "small", label: "Chico", amount_cents: 500_000, currency: "ARS", sort_order: 1 },
  { code: "medium", label: "Mediano", amount_cents: 1_000_000, currency: "ARS", sort_order: 2 },
];

describe("lib/contributions", () => {
  it("formatArs muestra pesos con separador de miles", () => {
    expect(formatArs(500_000)).toBe("$5.000");
    expect(formatArs(CONTRIBUTION_MAX_CENTS)).toBe("$500.000");
  });

  it("un importe sugerido manda sobre el importe libre", () => {
    expect(parseContributionAmount({ optionCode: "medium", amountCents: 123 }, OPTIONS)).toEqual({ ok: true, amountCents: 1_000_000, optionCode: "medium" });
    expect(parseContributionAmount({ optionCode: "large" }, OPTIONS)).toMatchObject({ ok: false });
    expect(parseContributionAmount({ optionCode: 1 }, OPTIONS)).toMatchObject({ ok: false });
  });

  it("el importe libre exige pesos enteros dentro de los límites", () => {
    expect(parseContributionAmount({ amountCents: CONTRIBUTION_MIN_CENTS }, OPTIONS)).toEqual({ ok: true, amountCents: CONTRIBUTION_MIN_CENTS, optionCode: null });
    expect(parseContributionAmount({ amountCents: CONTRIBUTION_MAX_CENTS }, OPTIONS)).toMatchObject({ ok: true });
    expect(parseContributionAmount({ amountCents: CONTRIBUTION_MIN_CENTS - 100 }, OPTIONS)).toMatchObject({ ok: false, error: expect.stringMatching(/\$1\.000 y \$500\.000/) });
    expect(parseContributionAmount({ amountCents: CONTRIBUTION_MAX_CENTS + 100 }, OPTIONS)).toMatchObject({ ok: false });
    expect(parseContributionAmount({ amountCents: 250_050 }, OPTIONS)).toMatchObject({ ok: false, error: expect.stringMatching(/sin centavos/) });
    expect(parseContributionAmount({ amountCents: "250000" }, OPTIONS)).toMatchObject({ ok: false });
    expect(parseContributionAmount({}, OPTIONS)).toMatchObject({ ok: false });
  });

  it("traduce estados y el resultado de vuelta de Mercado Pago", () => {
    expect(contributionStatusLabel("approved")).toBe("Aprobado");
    expect(contributionStatusLabel("charged_back")).toBe("Contracargo");
    expect(parseContributionReturnResult("aprobado")).toBe("aprobado");
    expect(parseContributionReturnResult(["aprobado"])).toBeNull();
    expect(parseContributionReturnResult("otro")).toBeNull();
  });
});

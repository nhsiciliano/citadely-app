import { describe, expect, it } from "vitest";
import { getPasswordValidationError } from "@/lib/password";
import { generatePromoCode, normalizePromoCode, promoCodeHash, validPromoSettings } from "@/lib/promo-codes";

describe("getPasswordValidationError", () => {
  it("exige 8 caracteres, mayúscula, minúscula y número", () => {
    expect(getPasswordValidationError("Abcdef1")).toMatch(/8 caracteres/);
    expect(getPasswordValidationError("abcdefg1")).toMatch(/mayúscula/);
    expect(getPasswordValidationError("ABCDEFG1")).toMatch(/minúscula/);
    expect(getPasswordValidationError("Abcdefgh")).toMatch(/número/);
    expect(getPasswordValidationError("Abcdefg1")).toBeNull();
    expect(getPasswordValidationError("Ñandú2026")).toBeNull();
  });
});

describe("lib/promo-codes", () => {
  it("genera códigos que se normalizan al mismo valor", () => {
    const code = generatePromoCode();
    expect(code).toMatch(/^CTD(-[0-9A-F]{4}){8}$/);
    const normalized = normalizePromoCode(code);
    expect(normalized).toMatch(/^CTD[0-9A-F]{32}$/);
    expect(normalizePromoCode(` ${code.toLowerCase()} `)).toBe(normalized);
    expect(promoCodeHash(normalized as string)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rechaza códigos inválidos y límites fuera de rango", () => {
    expect(normalizePromoCode("hola")).toBeNull();
    expect(normalizePromoCode(123)).toBeNull();
    expect(normalizePromoCode("A".repeat(81))).toBeNull();
    expect(validPromoSettings(30, 2)).toBe(true);
    expect(validPromoSettings(0, 2)).toBe(false);
    expect(validPromoSettings(30, 1001)).toBe(false);
    expect(validPromoSettings("30", 2)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { getPasswordValidationError } from "@/lib/password";

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

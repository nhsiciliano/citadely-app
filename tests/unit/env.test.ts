import { afterEach, describe, expect, it, vi } from "vitest";
import { withEnv } from "./helpers";

afterEach(() => vi.unstubAllEnvs());

describe("lib/env", () => {
  it("no reporta problemas fuera de producción", async () => {
    const { getProductionEnvProblems } = await import("@/lib/env");
    expect(getProductionEnvProblems({ VERCEL_ENV: "preview", MERCADOPAGO_ACCESS_TOKEN: "TEST-1", RESEND_SKIP_DELIVERY: "true" })).toEqual([]);
  });

  it("rechaza token de prueba y emails desactivados en producción", async () => {
    const { getProductionEnvProblems, assertProductionEnv } = await import("@/lib/env");
    const env = { VERCEL_ENV: "production", MERCADOPAGO_ACCESS_TOKEN: "TEST-1", RESEND_SKIP_DELIVERY: "true" };
    expect(getProductionEnvProblems(env)).toHaveLength(2);
    expect(() => assertProductionEnv(env)).toThrow(/Configuración de producción inválida/);
    expect(getProductionEnvProblems({ VERCEL_ENV: "production", MERCADOPAGO_ACCESS_TOKEN: "APP_USR-1" })).toEqual([]);
  });

  it("ignora el email de pago y el bypass de Vercel en producción", async () => {
    const preview = await withEnv({ VERCEL_ENV: "preview", MERCADOPAGO_PAYER_EMAIL: "p@test.com", VERCEL_AUTOMATION_BYPASS_SECRET: "s" }, () => import("@/lib/env"));
    expect(preview.getPayerEmailOverride()).toBe("p@test.com");
    expect(preview.getProtectionBypassSecret()).toBe("s");
    const production = await withEnv({ VERCEL_ENV: "production", MERCADOPAGO_PAYER_EMAIL: "p@test.com", VERCEL_AUTOMATION_BYPASS_SECRET: "s" }, () => import("@/lib/env"));
    expect(production.getPayerEmailOverride()).toBeUndefined();
    expect(production.getProtectionBypassSecret()).toBeUndefined();
  });
});

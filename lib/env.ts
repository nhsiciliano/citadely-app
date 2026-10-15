/**
 * Environment gate. Vercel sets VERCEL_ENV to "production" | "preview" | "development";
 * outside Vercel (local dev, CI) it is undefined and treated as non-production.
 * NEXT_PUBLIC_VERCEL_ENV is the client-readable twin (requires "Automatically expose
 * System Environment Variables" in the Vercel project settings).
 */
export const isProduction = process.env.VERCEL_ENV === "production";

export const isClientProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === "production";

/** Preview-only override: lets Mercado Pago test accounts subscribe with a fixed payer. */
export function getPayerEmailOverride() {
  if (isProduction) return undefined;
  return process.env.MERCADOPAGO_PAYER_EMAIL || undefined;
}

/** Preview-only secret that lets Mercado Pago webhooks pass Vercel Deployment Protection. */
export function getProtectionBypassSecret() {
  if (isProduction) return undefined;
  return process.env.VERCEL_AUTOMATION_BYPASS_SECRET || undefined;
}

/** Problems that must never reach production. Empty outside production. */
export function getProductionEnvProblems(env: Record<string, string | undefined> = process.env) {
  if (env.VERCEL_ENV !== "production") return [];

  const problems: string[] = [];
  if (env.MERCADOPAGO_ACCESS_TOKEN?.startsWith("TEST-")) {
    problems.push("MERCADOPAGO_ACCESS_TOKEN es un token de prueba (TEST-) en producción.");
  }
  // Unset means "deliver"; only an explicit "true" suppresses delivery (see lib/resend.ts).
  if (env.RESEND_SKIP_DELIVERY === "true") {
    problems.push("RESEND_SKIP_DELIVERY=true desactivaría todos los emails en producción.");
  }
  return problems;
}

export function assertProductionEnv(env: Record<string, string | undefined> = process.env) {
  const problems = getProductionEnvProblems(env);
  if (problems.length) {
    throw new Error(`Configuración de producción inválida:\n- ${problems.join("\n- ")}`);
  }
}

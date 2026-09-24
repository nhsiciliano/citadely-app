import "server-only";

import { createHash, randomBytes } from "node:crypto";

export const PROMO_MIN_DAYS = 1;
export const PROMO_MAX_DAYS = 365;
export const PROMO_MIN_USES = 1;
export const PROMO_MAX_USES = 1000;

export function validPromoSettings(days: unknown, uses: unknown) {
  return Number.isInteger(days) && Number(days) >= PROMO_MIN_DAYS && Number(days) <= PROMO_MAX_DAYS
    && Number.isInteger(uses) && Number(uses) >= PROMO_MIN_USES && Number(uses) <= PROMO_MAX_USES;
}

export function generatePromoCode() {
  const groups = randomBytes(16).toString("hex").toUpperCase().match(/.{4}/g);
  if (!groups) throw new Error("No se pudo generar el código.");
  return `CTD-${groups.join("-")}`;
}

export function normalizePromoCode(value: unknown) {
  if (typeof value !== "string" || value.length > 80) return null;
  const normalized = value.trim().replace(/[\s-]/g, "").toUpperCase();
  return /^CTD[A-F0-9]{32}$/.test(normalized) ? normalized : null;
}

export function promoCodeHash(normalizedCode: string) {
  return createHash("sha256").update(normalizedCode, "utf8").digest("hex");
}

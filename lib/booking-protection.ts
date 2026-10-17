import "server-only";

import { createHmac } from "node:crypto";
import { isProduction } from "@/lib/env";

export const BOOKING_LIMITS = {
  bodyBytes: 8_192,
  name: 120,
  email: 254,
  phone: 40,
  message: 2_000,
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const isUuid = (value: string) => UUID_PATTERN.test(value);
export const isEmail = (value: string) => EMAIL_PATTERN.test(value);
export const hasEnoughPhoneDigits = (value: string) => value.replace(/\D/g, "").length >= 6;

/** Best-effort client IP behind Vercel; undefined when running locally without a proxy. */
export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  return ip || undefined;
}

/** Keyed hash so the rate-limit table never stores raw IPs. */
export function hashIp(ip: string | undefined) {
  if (!ip) return null;
  // E2E runs send every booking from 127.0.0.1; the per-IP bucket would throttle the suite. Never honored in production.
  if (!isProduction && process.env.PUBLIC_BOOKING_SKIP_IP_LIMIT === "true") return null;
  const key = process.env.PUBLIC_BOOKING_HASH_SECRET ?? process.env.INSFORGE_API_KEY ?? "citadely-public-booking";
  return createHmac("sha256", key).update(ip).digest("hex");
}

export const ATTEMPT_REJECTIONS: Record<string, string> = {
  ip: "Hiciste demasiados intentos de reserva. Esperá unos minutos y probá de nuevo.",
  email: "Hiciste demasiados intentos con este email. Esperá unos minutos y probá de nuevo.",
  business: "Hay muchas reservas en este momento. Probá de nuevo en unos minutos.",
  pending_email: "Ya tenés reservas con seña pendiente de pago. Pagalas o esperá a que venzan antes de reservar otro turno.",
  pending_phone: "Ya hay reservas con seña pendiente de pago para este teléfono. Esperá a que venzan antes de reservar otro turno.",
};

export const isTurnstileEnabled = Boolean(process.env.TURNSTILE_SECRET_KEY);

/** Cloudflare Turnstile. Only enforced when TURNSTILE_SECRET_KEY is set. */
export async function verifyTurnstileToken(token: string, ip: string | undefined) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5_000),
    });
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch (error) {
    console.error("turnstile verification failed", error instanceof Error ? error.message : error);
    return false;
  }
}

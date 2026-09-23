import "server-only";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { insforgeAdmin } from "@/lib/insforge-admin";

export const ADMIN_COOKIE = "citadely_blog_admin";
export const ADMIN_COOKIE_PATH = "/admin-panel";
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function secret() {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET no configurado.");
  return value;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const aBytes = Buffer.from(a);
  const bBytes = Buffer.from(b);
  return aBytes.length === bBytes.length && timingSafeEqual(aBytes, bBytes);
}

export function createAdminSession() {
  const payload = Buffer.from(JSON.stringify({
    u: process.env.ADMIN_USERNAME ?? "admin",
    exp: Date.now() + ADMIN_SESSION_SECONDS * 1000,
    n: randomBytes(16).toString("hex"),
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(token: string | undefined) {
  if (!token) return false;
  try {
    const [payload, signature, extra] = token.split(".");
    if (!payload || !signature || extra || !safeEqual(signature, sign(payload))) return false;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { u?: string; exp?: number; n?: string };
    return data.u === (process.env.ADMIN_USERNAME ?? "admin")
      && typeof data.exp === "number" && data.exp > Date.now()
      && data.exp <= Date.now() + ADMIN_SESSION_SECONDS * 1000
      && typeof data.n === "string" && data.n.length === 32;
  } catch {
    return false;
  }
}

export async function hasAdminSession() {
  return verifyAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

export function hasAdminRequest(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  return verifyAdminToken(cookie ? decodeURIComponent(cookie.slice(ADMIN_COOKIE.length + 1)) : undefined);
}

export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  try {
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return Boolean(origin && new URL(origin).host === host);
  } catch {
    return false;
  }
}

export function verifyAdminPassword(username: string, password: string) {
  const configuredUser = process.env.ADMIN_USERNAME ?? "admin";
  const [algorithm, salt, expected] = (process.env.ADMIN_PASSWORD_HASH ?? "").split("$");
  if (algorithm !== "scrypt" || !salt || !expected || !password) return false;
  const actual = scryptSync(password, Buffer.from(salt, "hex"), 64).toString("hex");
  return safeEqual(username, configuredUser) && safeEqual(actual, expected);
}

function ipHash(request: Request) {
  const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  return createHmac("sha256", secret()).update(ip).digest("hex");
}

export async function isLoginBlocked(request: Request) {
  if (!insforgeAdmin) throw new Error("InsForge admin no configurado.");
  const { count, error } = await insforgeAdmin.database.from("blog_admin_login_attempts")
    .select("id", { count: "exact", head: true }).eq("ip_hash", ipHash(request))
    .gte("attempted_at", new Date(Date.now() - WINDOW_MS).toISOString());
  if (error) throw error;
  return (count ?? 0) >= MAX_ATTEMPTS;
}

export async function recordFailedLogin(request: Request) {
  if (!insforgeAdmin) throw new Error("InsForge admin no configurado.");
  const { error } = await insforgeAdmin.database.from("blog_admin_login_attempts")
    .insert([{ ip_hash: ipHash(request) }]);
  if (error) throw error;
}

export async function clearFailedLogins(request: Request) {
  if (!insforgeAdmin) throw new Error("InsForge admin no configurado.");
  const { error } = await insforgeAdmin.database.from("blog_admin_login_attempts")
    .delete().eq("ip_hash", ipHash(request));
  if (error) throw error;
}

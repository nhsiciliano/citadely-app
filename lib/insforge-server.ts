import "server-only";

import { cookies } from "next/headers";
import { createAuthActions, createServerClient, getAccessTokenCookieName } from "@insforge/sdk/ssr";
import { getInsforgePublicConfig } from "@/lib/insforge-config";

/** Cliente con la sesión de la cookie, para Server Components, Server Actions y Route Handlers. */
export async function createInsforgeServerClient() {
  return createServerClient({ ...getInsforgePublicConfig(), cookies: await cookies() });
}

/** Acciones de auth que escriben o borran las cookies de sesión (solo Server Actions y Route Handlers). */
export async function createInsforgeAuthActions() {
  return createAuthActions({ ...getInsforgePublicConfig(), cookies: await cookies() });
}

/** Token de la request: Bearer explícito (scripts, tests) o la cookie de sesión del navegador. */
export function getRequestAccessToken(request: Request & { cookies?: { get(name: string): { value: string } | undefined } }) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (bearer) return bearer;
  const cookieName = getAccessTokenCookieName();
  if (request.cookies) return request.cookies.get(cookieName)?.value ?? null;
  const match = request.headers.get("cookie")?.split(/;\s*/).find((part) => part.startsWith(`${cookieName}=`));
  return match ? decodeURIComponent(match.slice(cookieName.length + 1)) : null;
}

/** Cliente con un token ya resuelto (por ejemplo, el de getRequestAccessToken). */
export function createInsforgeTokenClient(accessToken: string) {
  return createServerClient({ ...getInsforgePublicConfig(), accessToken });
}

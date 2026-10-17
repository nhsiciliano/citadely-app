import { createBrowserClient, getAccessTokenCookieName } from "@insforge/sdk/ssr";
import { getInsforgePublicConfig } from "@/lib/insforge-config";

// Cliente para Client Components. Lee la sesión de la cookie insforge_access_token y la renueva por
// /api/auth/refresh. Su auth es de solo lectura: ingresar, salir y editar el perfil van por app/auth/actions.ts.
// En Server Components y rutas usá lib/insforge-server.ts (con sesión) o lib/insforge-public.ts (anónimo).
export const insforge = createBrowserClient(getInsforgePublicConfig());

export function readAccessTokenCookie() {
  if (typeof document === "undefined") return null;
  const name = `${getAccessTokenCookieName()}=`;
  const cookie = document.cookie.split(/;\s*/).find((part) => part.startsWith(name));
  return cookie ? decodeURIComponent(cookie.slice(name.length)) : null;
}

/**
 * El cliente se crea una sola vez por carga de página y guarda el token en memoria. Cuando una Server Action
 * cambia la sesión (login, registro, logout) sin recargar, hay que volver a leer la cookie.
 */
export function syncSessionFromCookie() {
  insforge.setAccessToken(readAccessTokenCookie());
}

function tokenExpiresAt(token: string) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/**
 * Deja una sesión vigente en la cookie (renovándola por /api/auth/refresh si falta o está por vencer) y en el
 * cliente. Usar antes de llamar a una ruta API que lee la cookie. No usa auth.getCurrentUser(): en el cliente
 * de navegador SSR depende de un usuario en memoria que la cookie no carga.
 */
export async function ensureFreshSession() {
  const token = readAccessTokenCookie();
  if (token && tokenExpiresAt(token) > Date.now() + 60_000) {
    insforge.setAccessToken(token);
    return true;
  }
  const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" }).catch(() => null);
  syncSessionFromCookie();
  return Boolean(response?.ok && readAccessTokenCookie());
}

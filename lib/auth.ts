import type { UserSchema } from "@insforge/sdk";

// "client" no tiene producto todavía: ni onboarding ni panel. Se mantiene hasta que el dueño del producto
// decida si se construye el área de cliente (plan, 5.5). No borrar sin esa decisión.
export type CitadelyRole = "business" | "client";

export type CitadelyProfile = {
  name?: string;
  role?: CitadelyRole;
  onboarding_complete?: boolean;
  business_name?: string;
  business_slug?: string;
  business_category?: string;
};

export function getCitadelyProfile(user: UserSchema | null): CitadelyProfile {
  return ((user?.profile ?? {}) as CitadelyProfile) ?? {};
}

export function getPostAuthPath(user: UserSchema | null) {
  const profile = getCitadelyProfile(user);

  if (profile.role === "client") {
    return "/";
  }

  if (!profile.role || !profile.onboarding_complete) {
    return "/onboarding";
  }

  return "/negocio";
}

export function slugifyBusinessName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Mensajes de InsForge en inglés que tienen traducción. Lo que no esté acá se muestra tal cual.
const KNOWN_ERROR_MESSAGES: Partial<Record<string, string>> = {
  "Invalid credentials": "Email o contraseña incorrectos.",
  "No refresh token provided": "Tu sesión venció. Volvé a ingresar.",
};

const KNOWN_ERROR_CODES: Partial<Record<string, string>> = {
  NETWORK_ERROR: "No pudimos conectar. Revisá tu conexión e intentá de nuevo.",
  REQUEST_TIMEOUT: "La conexión tardó demasiado. Intentá de nuevo.",
  CONNECTION_FAILED: "No pudimos conectar con el servidor. Intentá de nuevo en unos minutos.",
};

function translateErrorMessage(message: string, code?: unknown) {
  const known = KNOWN_ERROR_MESSAGES[message];
  if (known) return known;
  if (typeof code === "string" && KNOWN_ERROR_CODES[code]) return KNOWN_ERROR_CODES[code];
  return message;
}

export function getErrorMessage(error: unknown) {
  if (!error) return "Ocurrió un error inesperado.";
  if (typeof error === "string") return translateErrorMessage(error);
  if (error instanceof Error) return translateErrorMessage(error.message, (error as { error?: unknown }).error);
  if (typeof error === "object" && "message" in error) {
    const { message, error: code } = error as { message?: unknown; error?: unknown };
    return translateErrorMessage(String(message), code);
  }
  return "Ocurrió un error inesperado.";
}

// Nombre de la persona entre el registro y la verificación del email. Va en sessionStorage, no en la URL.
export const PENDING_PROFILE_NAME_KEY = "citadely:pending-profile-name";

export function storePendingProfileName(name: string) {
  try {
    window.sessionStorage.setItem(PENDING_PROFILE_NAME_KEY, name);
  } catch {
    // Sin sessionStorage (navegación privada o bloqueado) el nombre se pide de nuevo en el perfil.
  }
}

export function readPendingProfileName() {
  try {
    return window.sessionStorage.getItem(PENDING_PROFILE_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearPendingProfileName() {
  try {
    window.sessionStorage.removeItem(PENDING_PROFILE_NAME_KEY);
  } catch {
    // Nada que limpiar si el storage no está disponible.
  }
}

import type { UserSchema } from "@insforge/sdk";

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

export function getErrorMessage(error: unknown) {
  if (!error) return "Ocurrio un error inesperado.";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  return "Ocurrio un error inesperado.";
}

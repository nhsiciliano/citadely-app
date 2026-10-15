"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { UserSchema } from "@insforge/sdk";
import { getErrorMessage, getPostAuthPath, type CitadelyProfile } from "@/lib/auth";
import { OAUTH_VERIFIER_COOKIE } from "@/lib/auth-cookies";
import { createInsforgeAuthActions, createInsforgeServerClient } from "@/lib/insforge-server";
import { getRequestOrigin } from "@/lib/request-origin";

// Todo lo que crea, cambia o cierra la sesión corre acá: la refresh cookie es httpOnly y la escribe el servidor.
// Las acciones devuelven solo datos seguros (nunca tokens) y errores como texto ya traducido.

export type AuthActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

function fail(error: unknown): { ok: false; error: string } {
  return { ok: false, error: getErrorMessage(error) };
}

export async function signInWithPasswordAction(input: { email: string; password: string }): Promise<AuthActionResult<{ redirectTo: string }>> {
  const auth = await createInsforgeAuthActions();
  const { data, error } = await auth.signInWithPassword(input);
  if (error || !data?.user) return fail(error ?? "No pudimos iniciar sesión.");
  return { ok: true, data: { redirectTo: getPostAuthPath(data.user as UserSchema) } };
}

export async function signUpAction(input: { name: string; email: string; password: string }): Promise<AuthActionResult<{ requireEmailVerification: boolean }>> {
  const auth = await createInsforgeAuthActions();
  const { data, error } = await auth.signUp({ ...input, redirectTo: `${await getRequestOrigin()}/login` });
  if (error) return fail(error);
  return { ok: true, data: { requireEmailVerification: Boolean(data?.requireEmailVerification) } };
}

export async function verifyEmailAction(input: { email: string; otp: string }): Promise<AuthActionResult> {
  const auth = await createInsforgeAuthActions();
  const { error } = await auth.verifyEmail(input);
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function resendVerificationEmailAction(email: string): Promise<AuthActionResult> {
  const client = await createInsforgeServerClient();
  const { error } = await client.auth.resendVerificationEmail({ email, redirectTo: `${await getRequestOrigin()}/login` });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

/** Actualiza el perfil de la sesión actual (rol, onboarding, datos del negocio). */
export async function setProfileAction(profile: CitadelyProfile): Promise<AuthActionResult> {
  const client = await createInsforgeServerClient();
  const { error } = await client.auth.setProfile(profile);
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function sendResetPasswordEmailAction(email: string): Promise<AuthActionResult> {
  const client = await createInsforgeServerClient();
  const { error } = await client.auth.sendResetPasswordEmail({ email, redirectTo: `${await getRequestOrigin()}/recuperar-password` });
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function exchangeResetPasswordTokenAction(input: { email: string; code: string }): Promise<AuthActionResult<{ token: string }>> {
  const client = await createInsforgeServerClient();
  const { data, error } = await client.auth.exchangeResetPasswordToken(input);
  if (error || !data?.token) return fail(error ?? "El código no es válido.");
  return { ok: true, data: { token: data.token } };
}

export async function resetPasswordAction(input: { newPassword: string; otp: string }): Promise<AuthActionResult> {
  const client = await createInsforgeServerClient();
  const { error } = await client.auth.resetPassword(input);
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

export async function signOutAction(): Promise<AuthActionResult> {
  const auth = await createInsforgeAuthActions();
  const { error } = await auth.signOut();
  if (error) return fail(error);
  return { ok: true, data: undefined };
}

/** Inicia OAuth con PKCE: guarda el verifier en una cookie httpOnly y redirige al proveedor. */
export async function startGoogleSignInAction(): Promise<AuthActionResult> {
  const auth = await createInsforgeAuthActions();
  const { data, error } = await auth.signInWithOAuth("google", {
    redirectTo: `${await getRequestOrigin()}/auth/callback`,
    skipBrowserRedirect: true,
  });
  if (error || !data.url || !data.codeVerifier) return fail(error ?? "No pudimos conectar con Google.");

  (await cookies()).set(OAUTH_VERIFIER_COOKIE, data.codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  redirect(data.url);
}

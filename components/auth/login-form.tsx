"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { signInWithPasswordAction, startGoogleSignInAction } from "@/app/auth/actions";
import { syncSessionFromCookie } from "@/lib/insforge";
import { Field, FormMessage, GoogleIcon, LoadingSpinner, SubmitButton } from "@/components/ui";
import { PasswordField } from "@/components/auth/password-field";

const OAUTH_ERRORS: Record<string, string> = {
  oauth_failed: "No pudimos completar el ingreso con Google. Probá de nuevo.",
  oauth_expired: "El ingreso con Google tardó demasiado. Probá de nuevo.",
};

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"password" | "google" | null>(null);

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPendingAction("password");
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const result = await signInWithPasswordAction({ email, password });

    if (!result.ok) {
      setPendingAction(null);
      setError(result.error);
      return;
    }

    syncSessionFromCookie();
    // Volver a la página del panel que pidió el login (solo rutas internas de /negocio).
    const next = searchParams.get("next");
    const destination = result.data.redirectTo === "/negocio" && next && /^\/negocio(\/[a-z0-9-]*)*$/.test(next)
      ? next
      : result.data.redirectTo;

    // La sesión ya está en cookies; refresh hace que el servidor vea al usuario al navegar.
    router.replace(destination);
    router.refresh();
  }

  async function handleGoogleLogin() {
    setPendingAction("google");
    setError(null);

    // Si sale bien, la acción redirige a Google y esta página se descarga.
    const result = await startGoogleSignInAction();
    setPendingAction(null);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="grid gap-5">
      {searchParams.get("verified") === "1" ? (
        <FormMessage type="success">
          Email verificado. Ya podés ingresar con tu cuenta.
        </FormMessage>
      ) : null}
      {OAUTH_ERRORS[searchParams.get("error") ?? ""] && !error ? (
        <FormMessage type="error">{OAUTH_ERRORS[searchParams.get("error") ?? ""]}</FormMessage>
      ) : null}
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <form method="post" className="grid gap-4" onSubmit={handlePasswordLogin}>
        <Field autoComplete="email" label="Email" name="email" placeholder="tu@email.com" type="email" />
        <PasswordField autoComplete="current-password" placeholder="Tu contraseña" />
        <SubmitButton disabled={pendingAction !== null} pending={pendingAction === "password"}>Ingresar</SubmitButton>
      </form>
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted">
        <span className="h-px flex-1 bg-line" />
        o 
        <span className="h-px flex-1 bg-line" />
      </div>
      <button
        className="button-secondary"
        aria-busy={pendingAction === "google"}
        disabled={pendingAction !== null}
        onClick={handleGoogleLogin}
        type="button"
      >
        {pendingAction === "google" ? <LoadingSpinner label="Conectando con Google" /> : <><GoogleIcon />Continuar con Google</>}
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-ink-soft">
        <Link className="font-semibold text-primary" href="/recuperar-password">
          Olvidé mi contraseña
        </Link>
        <span>
          ¿No tenés cuenta?{" "}
          <Link className="font-semibold text-primary" href="/registro">
            Crear cuenta
          </Link>
        </span>
      </div>
    </div>
  );
}

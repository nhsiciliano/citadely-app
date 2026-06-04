"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { getErrorMessage, getPostAuthPath } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handlePasswordLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");

    const { data, error: signInError } = await insforge.auth.signInWithPassword({
      email,
      password,
    });

    setPending(false);

    if (signInError) {
      setError(getErrorMessage(signInError));
      return;
    }

    router.push(getPostAuthPath(data?.user ?? null));
  }

  async function handleGoogleLogin() {
    setPending(true);
    setError(null);

    const redirectTo = `${window.location.origin}/onboarding`;
    const { error: oauthError } = await insforge.auth.signInWithOAuth({
      provider: "google",
      redirectTo,
    });

    setPending(false);
    if (oauthError) setError(getErrorMessage(oauthError));
  }

  return (
    <div className="grid gap-5">
      {searchParams.get("verified") === "1" ? (
        <FormMessage type="success">
          Email verificado. Ya podes ingresar con tu cuenta.
        </FormMessage>
      ) : null}
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <form className="grid gap-4" onSubmit={handlePasswordLogin}>
        <Field label="Email" name="email" placeholder="tu@email.com" type="email" />
        <Field label="Contrasena" name="password" placeholder="Tu contrasena" type="password" />
        <SubmitButton pending={pending}>Ingresar</SubmitButton>
      </form>
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        <span className="h-px flex-1 bg-[var(--line)]" />
        o continua con
        <span className="h-px flex-1 bg-[var(--line)]" />
      </div>
      <button
        className="min-h-12 rounded-full border border-[var(--line-strong)] bg-white/70 px-6 text-sm font-semibold text-[var(--ink)] hover:border-[var(--reception)] disabled:opacity-60"
        disabled={pending}
        onClick={handleGoogleLogin}
        type="button"
      >
        Google
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--ink-soft)]">
        <Link className="font-semibold text-[var(--reception)]" href="/recuperar-password">
          Olvide mi contrasena
        </Link>
        <span>
          No tenes cuenta?{" "}
          <Link className="font-semibold text-[var(--reception)]" href="/registro">
            Crear cuenta
          </Link>
        </span>
      </div>
    </div>
  );
}

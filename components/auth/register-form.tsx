"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { getPasswordValidationError } from "@/lib/password";
import { PasswordField } from "@/components/auth/password-field";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "");
    const email = String(form.get("email") ?? "");
    const password = String(form.get("password") ?? "");
    const passwordError = getPasswordValidationError(password);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    setPending(true);

    const { data, error: signUpError } = await insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo: `${window.location.origin}/login`,
    });

    if (signUpError) {
      setPending(false);
      setError(getErrorMessage(signUpError));
      return;
    }

    if (data?.requireEmailVerification) {
      const params = new URLSearchParams({ email, name });
      router.push(`/verificar-email?${params.toString()}`);
      return;
    }

    const { error: profileError } = await insforge.auth.setProfile({
      name,
      role: "business",
      onboarding_complete: false,
    });

    setPending(false);

    if (profileError) {
      setError(getErrorMessage(profileError));
      return;
    }

    router.push("/onboarding");
  }

  return (
    <div className="grid gap-5">
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <form className="grid gap-4" onSubmit={handleSubmit}>
        <Field autoComplete="name" label="Nombre" name="name" placeholder="Tu nombre" />
        <Field autoComplete="email" label="Email" name="email" placeholder="tu@email.com" type="email" />
        <PasswordField
          autoComplete="new-password"
          placeholder="Creá una contraseña segura"
          requireStrongPassword
        />
        <SubmitButton pending={pending}>Crear cuenta</SubmitButton>
      </form>
      <p className="border border-[var(--color-line)] bg-[var(--color-surface-subtle)] px-4 py-3 text-xs font-medium leading-5 text-[var(--color-ink-muted)]">
        Tu cuenta queda preparada para agenda, reservas públicas y comunicaciones por email.
      </p>
      <p className="text-sm text-[var(--ink-soft)]">
        ¿Ya tenés cuenta?{" "}
        <Link className="font-semibold text-[var(--reception)]" href="/login">
          Ingresar
        </Link>
      </p>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { setProfileAction, signUpAction } from "@/app/auth/actions";
import { storePendingProfileName } from "@/lib/auth";
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

    const signUp = await signUpAction({ email, password, name });

    if (!signUp.ok) {
      setPending(false);
      setError(signUp.error);
      return;
    }

    if (signUp.data.requireEmailVerification) {
      storePendingProfileName(name);
      const params = new URLSearchParams({ email });
      router.push(`/verificar-email?${params.toString()}`);
      return;
    }

    const profile = await setProfileAction({ name, role: "business", onboarding_complete: false });

    setPending(false);

    if (!profile.ok) {
      setError(profile.error);
      return;
    }

    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="grid gap-5">
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <form method="post" className="grid gap-4" onSubmit={handleSubmit}>
        <Field autoComplete="name" label="Nombre" name="name" placeholder="Tu nombre" />
        <Field autoComplete="email" label="Email" name="email" placeholder="tu@email.com" type="email" />
        <PasswordField
          autoComplete="new-password"
          placeholder="Creá una contraseña segura"
          requireStrongPassword
        />
        <SubmitButton pending={pending}>Crear cuenta</SubmitButton>
      </form>
      <p className="border border-line bg-surface-subtle px-4 py-3 text-xs font-medium leading-5 text-ink-muted">
        Tu cuenta queda preparada para agenda, reservas públicas y comunicaciones por email.
      </p>
      <p className="text-sm text-ink-soft">
        ¿Ya tenés cuenta?{" "}
        <Link className="font-semibold text-primary" href="/login">
          Ingresar
        </Link>
      </p>
    </div>
  );
}

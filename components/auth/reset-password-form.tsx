"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { getPasswordValidationError } from "@/lib/password";
import { PasswordField } from "@/components/auth/password-field";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

export function ResetPasswordForm() {
  const [step, setStep] = useState<"request" | "reset">("request");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const nextEmail = String(form.get("email") ?? "");
    const { error: requestError } = await insforge.auth.sendResetPasswordEmail({
      email: nextEmail,
      redirectTo: `${window.location.origin}/recuperar-password`,
    });

    setPending(false);

    if (requestError) {
      setError(getErrorMessage(requestError));
      return;
    }

    setEmail(nextEmail);
    setStep("reset");
    setSuccess("Te enviamos un código para cambiar tu contraseña.");
  }

  async function exchangeCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const code = String(form.get("code") ?? "");
    const { data, error: exchangeError } = await insforge.auth.exchangeResetPasswordToken({
      email,
      code,
    });

    setPending(false);

    if (exchangeError) {
      setError(getErrorMessage(exchangeError));
      return;
    }

    setToken(data?.token ?? "");
    setSuccess("Código validado. Ingresá tu nueva contraseña.");
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const newPassword = String(form.get("password") ?? "");
    const passwordError = getPasswordValidationError(newPassword);

    if (passwordError) {
      setError(passwordError);
      return;
    }

    setPending(true);
    const { error: resetError } = await insforge.auth.resetPassword({
      newPassword,
      otp: token,
    });

    setPending(false);

    if (resetError) {
      setError(getErrorMessage(resetError));
      return;
    }

    setSuccess("Contraseña actualizada. Ya podés ingresar.");
  }

  return (
    <div className="grid gap-5">
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      {success ? <FormMessage type="success">{success}</FormMessage> : null}
      {step === "request" ? (
        <form className="grid gap-4" onSubmit={requestCode}>
          <Field label="Email" name="email" placeholder="tu@email.com" type="email" />
          <SubmitButton pending={pending}>Enviar código</SubmitButton>
        </form>
      ) : token ? (
        <form className="grid gap-4" onSubmit={resetPassword}>
          <PasswordField
            autoComplete="new-password"
            label="Nueva contraseña"
            placeholder="Creá una contraseña segura"
            requireStrongPassword
          />
          <SubmitButton pending={pending}>Actualizar contraseña</SubmitButton>
        </form>
      ) : (
        <form className="grid gap-4" onSubmit={exchangeCode}>
          <Field label="Código recibido" name="code" placeholder="123456" />
          <SubmitButton pending={pending}>Validar código</SubmitButton>
        </form>
      )}
      <Link className="text-sm font-semibold text-[var(--reception)]" href="/login">
        Volver a ingresar
      </Link>
    </div>
  );
}

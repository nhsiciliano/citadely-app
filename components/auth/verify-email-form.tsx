"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const defaultEmail = searchParams.get("email") ?? "";
  const defaultName = searchParams.get("name") ?? "";

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const otp = String(form.get("otp") ?? "");

    const { error: verifyError } = await insforge.auth.verifyEmail({ email, otp });

    if (verifyError) {
      setPending(false);
      setError(getErrorMessage(verifyError));
      return;
    }

    const { error: profileError } = await insforge.auth.setProfile({
      name: defaultName,
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

  async function resendCode() {
    setPending(true);
    setError(null);
    setSuccess(null);

    const { error: resendError } = await insforge.auth.resendVerificationEmail({
      email: defaultEmail,
      redirectTo: `${window.location.origin}/login`,
    });

    setPending(false);

    if (resendError) {
      setError(getErrorMessage(resendError));
      return;
    }

    setSuccess("Te enviamos un nuevo codigo de verificacion.");
  }

  return (
    <div className="grid gap-5">
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      {success ? <FormMessage type="success">{success}</FormMessage> : null}
      <form className="grid gap-4" onSubmit={handleVerify}>
        <Field label="Email" name="email" type="email" defaultValue={defaultEmail} />
        <Field label="Codigo de 6 digitos" name="otp" placeholder="123456" />
        <SubmitButton pending={pending}>Verificar email</SubmitButton>
      </form>
      <button
        className="text-left text-sm font-semibold text-[var(--reception)] disabled:opacity-60"
        disabled={pending || !defaultEmail}
        onClick={resendCode}
        type="button"
      >
        Reenviar codigo
      </button>
    </div>
  );
}

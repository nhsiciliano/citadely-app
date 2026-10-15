"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";
import { resendVerificationEmailAction, setProfileAction, verifyEmailAction } from "@/app/auth/actions";
import { clearPendingProfileName, readPendingProfileName } from "@/lib/auth";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

export function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const defaultEmail = searchParams.get("email") ?? "";
  const [defaultName] = useState(readPendingProfileName);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "");
    const otp = String(form.get("otp") ?? "");

    const verified = await verifyEmailAction({ email, otp });

    if (!verified.ok) {
      setPending(false);
      setError(verified.error);
      return;
    }

    const profile = await setProfileAction({ name: defaultName, role: "business", onboarding_complete: false });

    setPending(false);

    if (!profile.ok) {
      setError(profile.error);
      return;
    }

    clearPendingProfileName();
    router.push("/onboarding");
    router.refresh();
  }

  async function resendCode() {
    setPending(true);
    setError(null);
    setSuccess(null);

    const resent = await resendVerificationEmailAction(defaultEmail);

    setPending(false);

    if (!resent.ok) {
      setError(resent.error);
      return;
    }

    setSuccess("Te enviamos un nuevo código de verificación.");
  }

  return (
    <div className="grid gap-5">
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      {success ? <FormMessage type="success">{success}</FormMessage> : null}
      <form method="post" className="grid gap-4" onSubmit={handleVerify}>
        <Field label="Email" name="email" type="email" defaultValue={defaultEmail} />
        <Field label="Código de 6 dígitos" name="otp" placeholder="123456" />
        <SubmitButton pending={pending}>Verificar email</SubmitButton>
      </form>
      <button
        className="text-left text-sm font-semibold text-primary disabled:opacity-60"
        disabled={pending || !defaultEmail}
        onClick={resendCode}
        type="button"
      >
        Reenviar código
      </button>
    </div>
  );
}

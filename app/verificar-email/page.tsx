import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { AuthShell } from "@/components/ui";

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Verifica tu email"
      subtitle="InsForge envio un codigo de 6 digitos. Ingresalo para activar tu cuenta y continuar."
      aside={<VerifyAside />}
    >
      <Suspense fallback={<p className="text-sm text-[var(--ink-soft)]">Cargando verificacion...</p>}>
        <VerifyEmailForm />
      </Suspense>
    </AuthShell>
  );
}

function VerifyAside() {
  return (
    <div className="grid gap-5">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--clinical)]">
        Seguridad
      </p>
      <h2 className="text-3xl font-semibold tracking-[-0.05em]">
        Confirmamos que el email pueda recibir avisos de turnos.
      </h2>
      <p className="leading-7 text-[var(--ink-soft)]">
        Esta verificacion tambien prepara el canal para recordatorios automaticos por email.
      </p>
    </div>
  );
}

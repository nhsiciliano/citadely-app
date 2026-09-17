import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";
import { AuthShell } from "@/components/ui";
import { NO_INDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Verificar email",
  robots: NO_INDEX_ROBOTS,
};

export default function VerifyEmailPage() {
  return (
    <AuthShell
      title="Verificá tu email"
      subtitle="Ingresá el código de 6 dígitos que recibiste para activar tu cuenta y continuar."
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
      <h2 className="font-display text-3xl font-semibold tracking-[-0.035em]">
        Un paso breve antes de abrir tu agenda.
      </h2>
      <p className="leading-7 text-white/70">
        La verificación protege tu cuenta y confirma que podés recibir comunicaciones importantes.
      </p>
    </div>
  );
}

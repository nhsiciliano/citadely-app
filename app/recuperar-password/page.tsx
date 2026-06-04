import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthShell } from "@/components/ui";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      title="Recuperar acceso"
      subtitle="Solicita un codigo por email y define una nueva contrasena para volver a tu agenda."
      aside={<ResetAside />}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}

function ResetAside() {
  return (
    <div className="grid gap-5">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--amber)]">
        Cuenta
      </p>
      <h2 className="text-3xl font-semibold tracking-[-0.05em]">
        El reset usa codigos temporales de InsForge.
      </h2>
      <p className="leading-7 text-[var(--ink-soft)]">
        No guardamos contrasenas en la app. El flujo queda delegado al backend de autenticacion.
      </p>
    </div>
  );
}

import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/ui";

export default function LoginPage() {
  return (
    <AuthShell
      title="Volvé a tu central de turnos"
      subtitle="Ingresá con email y contraseña o continuá con Google para administrar tu negocio."
      aside={<AuthAside />}
    >
      <Suspense fallback={<p className="text-sm text-[var(--ink-soft)]">Cargando formulario...</p>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}

function AuthAside() {
  return (
    <div className="grid gap-5">
      <h2 className="font-display text-3xl font-semibold tracking-[-0.035em]">
        Retomá la jornada donde la dejaste.
      </h2>
      <ul className="grid gap-3 text-sm leading-6 text-white/70">
        <li>Próximo turno y señas pendientes a la vista.</li>
        <li>Agenda diaria y semanal en un mismo lugar.</li>
        <li>Tu página pública lista para recibir reservas.</li>
      </ul>
    </div>
  );
}

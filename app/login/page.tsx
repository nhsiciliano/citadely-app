import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AuthShell } from "@/components/ui";

export default function LoginPage() {
  return (
    <AuthShell
      title="Volver a la agenda"
      subtitle="Ingresa con email y contrasena o continua con Google para administrar tu negocio, agenda y reservas."
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
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--reception)]">
        Operacion diaria
      </p>
      <h2 className="text-3xl font-semibold tracking-[-0.05em]">
        Tu mostrador digital queda listo para abrir.
      </h2>
      <ul className="grid gap-3 text-sm leading-6 text-[var(--ink-soft)]">
        <li>Dashboard con citas, ingresos y ocupacion.</li>
        <li>Pagina publica por negocio.</li>
        <li>Reservas de clientes sin cuenta.</li>
      </ul>
    </div>
  );
}

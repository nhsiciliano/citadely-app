import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/ui";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Crea una cuenta de negocio para publicar tu pagina de reservas y administrar tu agenda."
      aside={<RegisterAside />}
    >
      <RegisterForm />
    </AuthShell>
  );
}

function RegisterAside() {
  return (
    <div className="grid gap-5">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terracotta)]">
        MVP negocio unico
      </p>
      <h2 className="text-3xl font-semibold tracking-[-0.05em]">
        Por ahora, cada cuenta negocio administra una sola marca.
      </h2>
      <p className="leading-7 text-[var(--ink-soft)]">
        Despues del registro, el onboarding te pedira nombre, rubro y URL publica del negocio.
      </p>
    </div>
  );
}

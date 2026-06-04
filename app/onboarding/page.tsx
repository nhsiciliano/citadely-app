import { OnboardingForm } from "@/components/onboarding-form";
import { AuthShell } from "@/components/ui";

export default function OnboardingPage() {
  return (
    <AuthShell
      title="Configura tu acceso"
      subtitle="Completa el rol y, si sos negocio, define la marca que tendra su pagina publica de reservas."
      aside={<OnboardingAside />}
    >
      <OnboardingForm />
    </AuthShell>
  );
}

function OnboardingAside() {
  return (
    <div className="grid gap-5">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--reception)]">
        Puesta en marcha
      </p>
      <h2 className="text-3xl font-semibold tracking-[-0.05em]">
        El negocio unico simplifica el MVP.
      </h2>
      <p className="leading-7 text-[var(--ink-soft)]">
        En fase 3 esta informacion pasara a tablas dedicadas de InsForge DB con politicas por usuario.
      </p>
    </div>
  );
}

import { OnboardingForm } from "@/components/onboarding-form";
import { AuthShell } from "@/components/ui";

export default function OnboardingPage() {
  return (
    <AuthShell
      title="Configurá tu negocio"
      subtitle="Definí el nombre, el rubro y la dirección que tendrá tu página pública de reservas."
      aside={<OnboardingAside />}
    >
      <OnboardingForm />
    </AuthShell>
  );
}

function OnboardingAside() {
  return (
    <div className="grid gap-5">
      <h2 className="font-display text-3xl font-semibold tracking-[-0.035em]">
        Tu central empieza con una identidad clara.
      </h2>
      <p className="leading-7 text-white/70">
        Esta información presenta tu negocio y genera el enlace que compartirás con tus clientes.
      </p>
    </div>
  );
}

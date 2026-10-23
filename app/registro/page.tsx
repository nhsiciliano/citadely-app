import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";
import { AuthShell } from "@/components/ui";
import { NO_INDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Crear cuenta",
  description: "Creá tu cuenta gratis de Citadely y organizá los turnos de tu negocio.",
  robots: NO_INDEX_ROBOTS,
};

export default function RegisterPage() {
  return (
    <AuthShell
      title="Creá tu cuenta"
      subtitle="Prepará tu negocio para publicar reservas y administrar cada jornada con precisión."
      aside={<RegisterAside />}
    >
      <RegisterForm />
    </AuthShell>
  );
}

function RegisterAside() {
  return (
    <div className="grid gap-5">
      <h2 className="font-display text-3xl font-semibold tracking-[-0.035em]">
        Siete días para ordenar toda tu operación.
      </h2>
      <p className="leading-7 text-white/70">
        Después del registro configurás el nombre, el rubro y la dirección pública de tu negocio.
      </p>
    </div>
  );
}

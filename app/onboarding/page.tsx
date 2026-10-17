import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { AuthShell } from "@/components/ui";
import { getCitadelyProfile } from "@/lib/auth";
import { createInsforgeServerClient } from "@/lib/insforge-server";
import { getRequestOrigin } from "@/lib/request-origin";
import { NO_INDEX_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Configurar negocio",
  robots: NO_INDEX_ROBOTS,
};

export default async function OnboardingPage() {
  // Mismo origen en servidor y navegador para la URL de ejemplo (evita un error de hidratación).
  const publicOrigin = await getRequestOrigin();
  const client = await createInsforgeServerClient();
  const { data } = await client.auth.getCurrentUser();
  if (!data.user) redirect("/login?next=/onboarding");
  const profile = getCitadelyProfile(data.user);
  if (profile.role === "client") redirect("/");
  // Un negocio ya configurado no debe volver a pasar por el onboarding.
  if (profile.onboarding_complete) redirect("/negocio");
  return (
    <AuthShell
      title="Configurá tu negocio"
      subtitle="Definí el nombre, el rubro y la dirección que tendrá tu página pública de reservas."
      aside={<OnboardingAside />}
    >
      <OnboardingForm publicOrigin={publicOrigin} user={{ id: data.user.id, email: data.user.email ?? null, profile }} />
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

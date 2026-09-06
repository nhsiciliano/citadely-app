"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  getCitadelyProfile,
  getErrorMessage,
  slugifyBusinessName,
} from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { getBusinessPublicUrl } from "@/lib/urls";
import { saveBusinessNotificationEmail } from "@/lib/business-notifications";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

export function OnboardingForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data, error: userError } = await insforge.auth.getCurrentUser();

      if (!mounted) return;

      if (userError || !data.user) {
        router.replace("/login");
        return;
      }

      const profile = getCitadelyProfile(data.user);
      if (profile.role === "client") {
        router.replace("/");
        return;
      }

      setName(profile.business_name ?? "");
      setSlug(profile.business_slug ?? "");
      setPending(false);
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const businessName = String(form.get("business_name") ?? "");
    const businessCategory = String(form.get("business_category") ?? "");
    const businessSlug = slugifyBusinessName(String(form.get("business_slug") ?? businessName));

    const { data: userData, error: userError } = await insforge.auth.getCurrentUser();

    if (userError || !userData.user) {
      setPending(false);
      setError("Tu sesión expiró. Volvé a ingresar para continuar.");
      return;
    }

    const { data: existingBusiness } = await insforge.database
      .from("businesses")
      .select("id")
      .eq("owner_id", userData.user.id)
      .maybeSingle();

    const businessPayload = {
      owner_id: userData.user.id,
      name: businessName,
      category: businessCategory,
      slug: businessSlug,
    };

    const { data: savedBusiness, error: businessError } = existingBusiness
      ? await insforge.database
          .from("businesses")
          .update(businessPayload)
          .eq("id", existingBusiness.id)
          .select("id")
          .single()
      : await insforge.database
          .from("businesses")
          .insert([businessPayload])
          .select("id")
          .single();

    if (businessError) {
      setPending(false);
      setError(getErrorMessage(businessError));
      return;
    }

    const businessId = existingBusiness?.id ?? savedBusiness?.id;

    if (businessId) {
      const { error: notificationError } =
        (await saveBusinessNotificationEmail(businessId, userData.user.email)) ?? {};

      if (notificationError) {
        setPending(false);
        setError(getErrorMessage(notificationError));
        return;
      }
    }

    const { error: profileError } = await insforge.auth.setProfile({
      role: "business",
      onboarding_complete: true,
      business_name: businessName,
      business_category: businessCategory,
      business_slug: businessSlug,
    });

    setPending(false);

    if (profileError) {
      setError(getErrorMessage(profileError));
      return;
    }

    router.push("/negocio");
  }

  return (
    <div className="grid gap-5">
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <form className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <Field
            label="Nombre del negocio"
            name="business_name"
            placeholder="Barberia Norte"
            defaultValue={name}
          />
          <label className="form-label">
            Rubro
            <select
              className="form-control"
              name="business_category"
              required
            >
              <option value="barberia">Barbería / peluquería</option>
              <option value="salud">Consultorio médico</option>
              <option value="spa">Spa / estética</option>
              <option value="fitness">Fitness / bienestar</option>
              <option value="otros">Otros servicios</option>
            </select>
          </label>
          <Field
            label="URL pública"
            name="business_slug"
            placeholder="barberia-norte"
            defaultValue={slug || slugifyBusinessName(name)}
          />
          <p className="text-sm leading-6 text-[var(--ink-soft)]">
            Tu página pública quedará disponible en <strong>{getBusinessPublicUrl(slug || slugifyBusinessName(name) || "tu-negocio")}</strong>. Incluye 7 días de uso gratuito sin restricciones.
          </p>
        </div>

        <SubmitButton pending={pending}>Guardar y continuar</SubmitButton>
      </form>
    </div>
  );
}

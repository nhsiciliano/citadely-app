"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  getErrorMessage,
  slugifyBusinessName,
  type CitadelyProfile,
} from "@/lib/auth";
import { setProfileAction } from "@/app/auth/actions";
import { ensureFreshSession, insforge } from "@/lib/insforge";
import { getBusinessPublicUrl } from "@/lib/urls";
import { saveBusinessNotificationEmail } from "@/lib/business-notifications";
import { BUSINESS_SLUG_MAX_LENGTH, BUSINESS_SLUG_PATTERN, validateBusinessSlug } from "@/lib/business-slug";
import { READ_ONLY_HINT } from "@/lib/business-access";
import { getBusinessCategoryOptions } from "@/lib/business-categories";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

type SlugStatus = { state: "idle" | "checking" | "available" | "taken" | "invalid"; message?: string };

export type OnboardingUser = { id: string; email: string | null; profile: CitadelyProfile };

// La página resuelve la sesión y los redirects en el servidor; el formulario recibe el usuario ya validado.
export function OnboardingForm({ publicOrigin, user }: { publicOrigin: string; user: OnboardingUser }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [existingBusinessId, setExistingBusinessId] = useState<string | null>(null);
  // Datos guardados del negocio existente: permiten saltear el UPDATE cuando no hay cambios.
  const [savedValues, setSavedValues] = useState<{ name: string; category: string } | null>(null);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ state: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  // A business that already exists keeps its public URL: changing it would break links already shared.
  const slugLocked = existingBusinessId !== null;

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const profile = user.profile;

      // El negocio guardado manda sobre el perfil: así reabrir el formulario nunca pisa sus datos.
      const { data: business } = await insforge.database
        .from("businesses")
        .select("id,name,slug,category")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!mounted) return;

      if (business) {
        setExistingBusinessId(business.id);
        setSavedValues({ name: business.name ?? "", category: business.category ?? "" });
        setName(business.name ?? "");
        setSlug(business.slug ?? "");
        setCategory(business.category ?? "");
      } else {
        setName(profile.business_name ?? "");
        setSlug(profile.business_slug ?? "");
        // Solo cuenta como editado si el slug del perfil no es el derivado automáticamente del nombre.
        setSlugEdited(Boolean(profile.business_slug) && profile.business_slug !== slugifyBusinessName(profile.business_name ?? ""));
        setCategory(profile.business_category ?? "");
      }
      setPending(false);
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [user]);

  // Disponibilidad de la URL: validación local inmediata y consulta al servidor con debounce.
  useEffect(() => {
    if (slugLocked || pending) return;
    const localError = slug ? validateBusinessSlug(slug) : null;
    if (!slug || localError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derived status for the typed slug
      setSlugStatus(slug ? { state: "invalid", message: localError ?? undefined } : { state: "idle" });
      return;
    }

    setSlugStatus({ state: "checking" });
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data, error: rpcError } = await insforge.database.rpc("is_business_slug_available", { p_slug: slug });
      if (cancelled) return;
      if (rpcError) {
        // Sin respuesta confiable no bloqueamos: el servidor valida igual al guardar.
        setSlugStatus({ state: "idle" });
        return;
      }
      setSlugStatus(data === true ? { state: "available" } : { state: "taken", message: "Esa URL ya está en uso. Probá con otra." });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug, slugLocked, pending]);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugEdited && !slugLocked) setSlug(slugifyBusinessName(value));
  }

  function handleSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(value.toLowerCase().replace(/\s+/g, "-"));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const businessName = name.trim();
    const businessCategory = category;
    const businessSlug = slugLocked ? slug : slugifyBusinessName(slug || businessName);

    const slugError = slugLocked ? null : validateBusinessSlug(businessSlug);
    if (slugError) {
      setSlugStatus({ state: "invalid", message: slugError });
      return;
    }
    if (!slugLocked && slugStatus.state === "taken") {
      setError("Esa URL ya está en uso. Elegí otra para continuar.");
      return;
    }

    setPending(true);

    if (!(await ensureFreshSession())) {
      setPending(false);
      setError("Tu sesión expiró. Volvé a ingresar para continuar.");
      return;
    }

    const businessPayload = {
      owner_id: user.id,
      name: businessName,
      category: businessCategory,
      slug: businessSlug,
    };

    const unchanged = Boolean(existingBusinessId)
      && savedValues?.name === businessName
      && savedValues?.category === businessCategory;

    let savedBusinessId = existingBusinessId;
    let businessError: unknown = null;

    if (existingBusinessId) {
      // Con la suscripción vencida RLS rechaza la escritura: el UPDATE devuelve 0 filas en lugar de un error.
      if (!unchanged) {
        const { data: updated, error: updateError } = await insforge.database
          .from("businesses")
          .update(businessPayload)
          .eq("id", existingBusinessId)
          .select("id");
        businessError = updateError;
        if (!updateError && !updated?.length) {
          setPending(false);
          setError(READ_ONLY_HINT);
          return;
        }
      }
    } else {
      const { data: inserted, error: insertError } = await insforge.database
        .from("businesses")
        .insert([businessPayload])
        .select("id")
        .single();
      businessError = insertError;
      savedBusinessId = inserted?.id ?? null;
    }

    if (businessError) {
      setPending(false);
      const message = getErrorMessage(businessError);
      setError(/businesses_slug_key|duplicate key|unique constraint/i.test(message)
        ? "Esa URL ya está en uso. Elegí otra para continuar."
        : /businesses_slug_not_reserved/i.test(message)
          ? "Esa URL está reservada. Elegí otra."
          : message);
      return;
    }

    const businessId = savedBusinessId;

    if (businessId) {
      const { error: notificationError } =
        (await saveBusinessNotificationEmail(businessId, user.email)) ?? {};

      if (notificationError) {
        setPending(false);
        setError(getErrorMessage(notificationError));
        return;
      }
    }

    const profile = await setProfileAction({
      role: "business",
      onboarding_complete: true,
      business_name: businessName,
      business_category: businessCategory,
      business_slug: businessSlug,
    });

    setPending(false);

    if (!profile.ok) {
      setError(profile.error);
      return;
    }

    router.push("/negocio");
    router.refresh();
  }

  const publicUrl = getBusinessPublicUrl(slug || "tu-negocio", publicOrigin);
  const slugHint = slugLocked
    ? "La URL de un negocio existente no se cambia desde acá para no romper los enlaces ya compartidos."
    : slugStatus.state === "checking"
      ? "Verificando disponibilidad…"
      : slugStatus.state === "available"
        ? "Disponible."
        : slugStatus.message ?? "Solo letras minúsculas, números y guiones.";
  const slugInvalid = slugStatus.state === "invalid" || slugStatus.state === "taken";

  return (
    <div className="grid gap-5">
      {error ? <FormMessage type="error">{error}</FormMessage> : null}
      <form method="post" className="grid gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4">
          <Field
            id="business_name"
            label="Nombre del negocio"
            maxLength={120}
            name="business_name"
            onChange={handleNameChange}
            placeholder="Barberia Norte"
            value={name}
          />
          <label className="form-label">
            Rubro
            <select
              className="form-control"
              name="business_category"
              onChange={(event) => setCategory(event.target.value)}
              required
              value={category}
            >
              <option disabled value="">Elegí un rubro</option>
              {getBusinessCategoryOptions(category).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <Field
            describedBy="business_slug_hint"
            id="business_slug"
            invalid={slugInvalid}
            label="URL pública"
            maxLength={BUSINESS_SLUG_MAX_LENGTH}
            name="business_slug"
            onChange={handleSlugChange}
            pattern={BUSINESS_SLUG_PATTERN}
            placeholder="barberia-norte"
            readOnly={slugLocked}
            title="Letras minúsculas, números y guiones simples"
            value={slug}
          />
          <p
            aria-live="polite"
            className={`text-sm leading-6 ${slugInvalid ? "text-danger" : "text-ink-soft"}`}
            id="business_slug_hint"
          >
            {slugHint}
          </p>
          <p className="text-sm leading-6 text-ink-soft">
            Tu página pública quedará disponible en <strong>{publicUrl}</strong>. Incluye 7 días de uso gratuito sin restricciones.
          </p>
        </div>

        <SubmitButton pending={pending}>Guardar y continuar</SubmitButton>
      </form>
    </div>
  );
}

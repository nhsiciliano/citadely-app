"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ExternalLink, ImagePlus, Palette, Upload } from "lucide-react";
import { FormMessage, SubmitButton, TextArea } from "@/components/ui";
import { getSubscriptionState } from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { getBusinessPublicUrl } from "@/lib/urls";
import { insforge } from "@/lib/insforge";
import { useWorkspace } from "../workspace-context";
import { PageHeader } from "../workspace-ui";

const BUCKET = "business-assets";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function uploadFile(form: FormData, name: string) {
  const file = form.get(name);
  return file instanceof File && file.size > 0 ? file : null;
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "image";
}

async function uploadImage(businessId: string, folder: "logo" | "cover", file: File, previousKey?: string | null) {
  const maxBytes = folder === "logo" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Subí una imagen JPG, PNG o WebP.");
  if (file.size > maxBytes) throw new Error(`La imagen no puede superar ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const key = `${businessId}/${folder}/${Date.now()}-${safeName(file.name)}`;
  const bucket = insforge.storage.from(BUCKET);
  const uploaded = await bucket.upload(key, file);
  if (uploaded.error || !uploaded.data) throw new Error(uploaded.error?.message ?? "No se pudo subir la imagen.");
  if (previousKey && previousKey !== uploaded.data.key) void bucket.remove(previousKey);
  return uploaded.data;
}

function FileUpload({ label, name, current, note }: { label: string; name: string; current?: string | null; note: string }) {
  return (
    <label className="grid cursor-pointer gap-4 border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] p-4 hover:border-[var(--color-primary)] sm:grid-cols-[110px_1fr] sm:items-center">
      <span className="grid h-24 place-items-center overflow-hidden rounded-md bg-white" style={current ? { backgroundImage: `url(${current})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>
        {!current ? <ImagePlus aria-hidden="true" className="text-[var(--color-primary)]" size={24} /> : null}
      </span>
      <span><strong className="flex items-center gap-2 text-sm"><Upload aria-hidden="true" size={16} />{label}</strong><small className="mt-2 block leading-5 text-[var(--color-ink-soft)]">{note}</small><input accept="image/jpeg,image/png,image/webp" className="mt-3 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-navy)] file:px-3 file:py-2 file:font-semibold file:text-white" name={name} type="file" /></span>
    </label>
  );
}

export function PublicPageScreen() {
  const { business, refresh } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [description, setDescription] = useState(business.description ?? "");
  const [brandColor, setBrandColor] = useState(business.brand_color ?? "#0957d9");
  const subscription = getSubscriptionState(business);
  const publicUrl = getBusinessPublicUrl(business.slug);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscription.hasAccess) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const logo = uploadFile(form, "logo_file");
    const cover = uploadFile(form, "cover_file");
    setPending(true);
    setMessage(null);
    try {
      const [logoUpload, coverUpload] = await Promise.all([
        logo ? uploadImage(business.id, "logo", logo, business.logo_key) : Promise.resolve(null),
        cover ? uploadImage(business.id, "cover", cover, business.cover_image_key) : Promise.resolve(null),
      ]);
      const { error } = await insforge.database.from("businesses").update({
        description,
        brand_color: brandColor,
        ...(logoUpload ? { logo_url: logoUpload.url, logo_key: logoUpload.key } : {}),
        ...(coverUpload ? { cover_image_url: coverUpload.url, cover_image_key: coverUpload.key } : {}),
      }).eq("id", business.id);
      if (error) throw new Error(getErrorMessage(error));
      setMessage("Página pública actualizada.");
      formElement.reset();
      await refresh();
    } catch (saveError) {
      setMessage(getErrorMessage(saveError));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader actions={<Link className="button-secondary" href={publicUrl} target="_blank"><ExternalLink aria-hidden="true" size={16} />Abrir página</Link>} description="Editá la identidad del negocio y comprobá el resultado antes de guardarlo." title="Página pública" />
      <form className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(320px,.78fr)_minmax(440px,1.22fr)] lg:px-10 lg:py-8" onSubmit={save}>
        <section className="surface-section self-start">
          <div className="section-heading-row"><div><h2>Identidad del negocio</h2><p>Tu marca domina la experiencia de reserva.</p></div><Palette aria-hidden="true" className="text-[var(--color-primary)]" size={21} /></div>
          <div className="grid gap-5">
            <TextArea defaultValue={business.description ?? ""} label="Descripción" name="description" onChange={(value) => setDescription(value)} placeholder="Contá qué servicio ofrecés y qué necesita saber quien reserva." required={false} rows={5} />
            <label className="form-label">Color principal<span className="flex items-center gap-3"><input aria-label="Elegir color principal" className="h-12 w-16 cursor-pointer rounded-md border border-[var(--color-line)] bg-white p-1" name="brand_color" onChange={(event) => setBrandColor(event.target.value)} type="color" value={brandColor} /><span className="font-mono text-sm text-[var(--color-ink-soft)]">{brandColor.toUpperCase()}</span></span></label>
            <FileUpload current={business.logo_url} label="Logo" name="logo_file" note="JPG, PNG o WebP. Hasta 2 MB; recomendado 512 × 512 px." />
            <FileUpload current={business.cover_image_url} label="Portada" name="cover_file" note="JPG, PNG o WebP. Hasta 5 MB; recomendado 1600 × 600 px." />
            {!subscription.hasAccess ? <FormMessage type="error">Activá el plan mensual para personalizar la página pública.</FormMessage> : null}
            {message ? <FormMessage type={message.includes("actualizada") ? "success" : "error"}>{message}</FormMessage> : null}
            <SubmitButton disabled={!subscription.hasAccess} pending={pending}>Guardar cambios</SubmitButton>
          </div>
        </section>

        <section aria-label="Vista previa de la página pública" className="overflow-hidden border border-[var(--color-line)] bg-white shadow-[var(--shadow-raised)]">
          <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3"><span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">Vista previa</span><span className="text-xs text-[var(--color-ink-muted)]">citadely.com.ar/b/{business.slug}</span></div>
          <div className="min-h-[680px] bg-[#f6f8fb] p-4 sm:p-7">
            <div className="overflow-hidden bg-white shadow-[0_12px_36px_rgba(8,31,63,.12)]">
              <div className="h-48 bg-cover bg-center" style={{ backgroundColor: brandColor, backgroundImage: business.cover_image_url ? `linear-gradient(rgba(5,18,36,.12),rgba(5,18,36,.42)),url(${business.cover_image_url})` : undefined }} />
              <div className="relative px-5 pb-7 sm:px-8">
                <div className="-mt-11 grid h-22 w-22 place-items-center overflow-hidden rounded-md border-4 border-white bg-white shadow-md" style={business.logo_url ? { backgroundImage: `url(${business.logo_url})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{!business.logo_url ? <span className="text-2xl font-semibold" style={{ color: brandColor }}>{business.name.slice(0, 1).toUpperCase()}</span> : null}</div>
                <h2 className="mt-5 text-2xl font-semibold tracking-[-0.035em]">{business.name}</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--color-ink-soft)]">{description || "Agregá una descripción para presentar tu negocio y orientar a tus clientes."}</p>
                <div className="mt-7 border-t border-[var(--color-line)] pt-6"><h3 className="font-semibold">Elegí un servicio</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="border border-[var(--color-line)] p-4"><p className="font-semibold">Servicio de ejemplo</p><p className="mt-1 text-xs text-[var(--color-ink-soft)]">30 minutos</p><button className="mt-4 rounded-md px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }} type="button">Elegir</button></div><div className="border border-[var(--color-line)] p-4"><p className="font-semibold">Disponibilidad</p><p className="mt-1 text-xs text-[var(--color-ink-soft)]">Seleccioná una fecha y hora</p></div></div></div>
                <p className="mt-8 text-center text-[11px] text-[var(--color-ink-muted)]">Reservas gestionadas con Citadely</p>
              </div>
            </div>
          </div>
        </section>
      </form>
    </>
  );
}

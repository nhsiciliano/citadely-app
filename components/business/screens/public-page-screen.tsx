"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { CircleHelp, ExternalLink, Images, ImagePlus, LockKeyhole, MapPinned, Palette, Plus, Save, Trash2, Upload, Video } from "lucide-react";
import { FormMessage, LoadingSpinner, TextArea } from "@/components/ui";
import { VirtualPlatformIcon } from "@/components/virtual-platform-icon";
import type { BusinessFaq, BusinessGalleryImage } from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { getBusinessPublicUrl } from "@/lib/urls";
import { insforge } from "@/lib/insforge";
import { normalizePublicAddress } from "@/lib/public-profile";
import { normalizePublicTheme } from "@/lib/public-theme";
import { normalizeVirtualPlatforms, VIRTUAL_PLATFORM_OPTIONS, type ServiceMode, type VirtualPlatform } from "@/lib/virtual-service";
import { useWorkspace } from "../workspace-context";
import { PageHeader } from "../workspace-ui";
import { PublicPagePreview } from "../public-page-preview";
import { PublicThemeEditor } from "../public-theme-editor";

type DraftFaq = Omit<Pick<BusinessFaq, "id" | "question" | "answer" | "sort_order">, "id"> & { id?: string; localId: string };

const BUCKET = "business-assets";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

function uploadFile(form: FormData, name: string) {
  const file = form.get(name);
  return file instanceof File && file.size > 0 ? file : null;
}

function safeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "image";
}

async function uploadImage(businessId: string, folder: "logo" | "cover" | "gallery", file: File) {
  const maxBytes = folder === "logo" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (!IMAGE_TYPES.includes(file.type)) throw new Error("Subí una imagen JPG, PNG o WebP.");
  if (file.size > maxBytes) throw new Error(`La imagen no puede superar ${Math.round(maxBytes / 1024 / 1024)} MB.`);
  const key = `${businessId}/${folder}/${Date.now()}-${crypto.randomUUID()}-${safeName(file.name)}`;
  const bucket = insforge.storage.from(BUCKET);
  const uploaded = await bucket.upload(key, file);
  if (uploaded.error || !uploaded.data) throw new Error(uploaded.error?.message ?? "No se pudo subir la imagen.");
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
  const { access: subscription, appointments, availabilitySlots, business, galleryImages, faqs, refresh, services } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [description, setDescription] = useState(business.description ?? "");
  const [brandColor, setBrandColor] = useState(business.brand_color ?? "#0957d9");
  const [publicTheme, setPublicTheme] = useState(() => normalizePublicTheme(business.public_theme));
  const [publicAddress, setPublicAddress] = useState(business.public_address ?? "");
  const [serviceMode, setServiceMode] = useState<ServiceMode>(business.service_mode ?? "physical");
  const [virtualPlatforms, setVirtualPlatforms] = useState<VirtualPlatform[]>(normalizeVirtualPlatforms(business.virtual_platforms));
  const [savedGalleryImages, setSavedGalleryImages] = useState(galleryImages);
  const [removedGalleryIds, setRemovedGalleryIds] = useState<string[]>([]);
  const [galleryFileCount, setGalleryFileCount] = useState(0);
  const [draftFaqs, setDraftFaqs] = useState<DraftFaq[]>(
    faqs.map((faq) => ({ ...faq, localId: faq.id })),
  );
  const publicUrl = getBusinessPublicUrl(business.slug);
  const visibleGalleryImages = savedGalleryImages.filter((image) => !removedGalleryIds.includes(image.id));

  if (!subscription.hasPublicPageAccess) {
    return (
      <>
        <PageHeader description="Publicá una página personalizable y recibí reservas online con el plan Pro." title="Página pública" />
        <div className="px-5 py-6 sm:px-8 lg:px-10 lg:py-8">
          <section className="surface-section mx-auto max-w-3xl py-10 text-center sm:py-14">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-md bg-[var(--color-primary-soft)] text-[var(--color-primary)]"><LockKeyhole aria-hidden="true" size={23} /></span>
            <h2 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{subscription.needsPayment && subscription.currentPlan === "pro" ? "Tu página pública está pausada" : "La página pública está incluida en Pro"}</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-[var(--color-ink-soft)]">{subscription.needsPayment && subscription.currentPlan === "pro" ? "Tus clientes no pueden reservar online mientras la suscripción no esté activa. Activá el plan para volver a publicarla y editarla." : "Personalizá tu marca, publicá servicios y permití que tus clientes reserven los turnos disponibles sin contactarte."}</p>
            <Link className="button-primary mt-7" href="/negocio/configuracion">{subscription.needsPayment && subscription.currentPlan === "pro" ? "Activar plan" : "Ver plan Pro"}</Link>
          </section>
        </div>
      </>
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscription.hasPublicPageAccess) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const logo = uploadFile(form, "logo_file");
    const cover = uploadFile(form, "cover_file");
    const galleryFiles = Array.from(form.getAll("gallery_files")).filter((file): file is File => file instanceof File && file.size > 0);
    setPending(true);
    setMessage(null);
    const uploadedBrandingKeys: string[] = [];
    const uploadedGalleryKeys: string[] = [];
    let brandingPersisted = false;
    try {
      if (visibleGalleryImages.length + galleryFiles.length > 10) throw new Error("La galería admite hasta 10 fotos.");
      const normalizedFaqs = draftFaqs.map((faq) => ({ ...faq, question: faq.question.trim(), answer: faq.answer.trim() }));
      const normalizedAddress = normalizePublicAddress(publicAddress);
      if (serviceMode === "virtual" && virtualPlatforms.length === 0) throw new Error("Elegí al menos una plataforma para el servicio virtual.");
      if (normalizedFaqs.length > 10) throw new Error("FAQ admite hasta 10 preguntas.");
      if (normalizedFaqs.some((faq) => !faq.question || !faq.answer)) throw new Error("Completá pregunta y respuesta en cada FAQ.");
      if (normalizedAddress && normalizedAddress.length > 300) throw new Error("La dirección admite hasta 300 caracteres.");

      const [logoUpload, coverUpload] = await Promise.all([
        logo
          ? uploadImage(business.id, "logo", logo).then((upload) => {
              uploadedBrandingKeys.push(upload.key);
              return upload;
            })
          : Promise.resolve(null),
        cover
          ? uploadImage(business.id, "cover", cover).then((upload) => {
              uploadedBrandingKeys.push(upload.key);
              return upload;
            })
          : Promise.resolve(null),
      ]);
      const galleryUploads = await Promise.all(galleryFiles.map((file) => (
        uploadImage(business.id, "gallery", file).then((upload) => {
          uploadedGalleryKeys.push(upload.key);
          return upload;
        })
      )));

      const { error } = await insforge.database.from("businesses").update({
        description,
        brand_color: brandColor,
        public_theme: normalizePublicTheme(publicTheme),
        public_address: normalizedAddress,
        service_mode: serviceMode,
        virtual_platforms: virtualPlatforms,
        ...(logoUpload ? { logo_url: logoUpload.url, logo_key: logoUpload.key } : {}),
        ...(coverUpload ? { cover_image_url: coverUpload.url, cover_image_key: coverUpload.key } : {}),
      }).eq("id", business.id);
      if (error) throw new Error(getErrorMessage(error));
      brandingPersisted = true;

      const replacedBrandingKeys = [
        logoUpload && business.logo_key ? business.logo_key : null,
        coverUpload && business.cover_image_key ? business.cover_image_key : null,
      ].filter((key): key is string => Boolean(key));
      if (replacedBrandingKeys.length > 0) {
        await Promise.all(replacedBrandingKeys.map((key) => insforge.storage.from(BUCKET).remove(key)));
      }

      const galleryPayload = [
        ...visibleGalleryImages.map((image) => ({ image_url: image.image_url, image_key: image.image_key })),
        ...galleryUploads.map((upload) => ({ image_url: upload.url, image_key: upload.key })),
      ];
      const faqPayload = normalizedFaqs.map((faq) => ({ question: faq.question, answer: faq.answer }));
      const { error: sectionsError } = await insforge.database.rpc("sync_business_public_sections", {
        p_business_id: business.id,
        p_gallery_images: galleryPayload,
        p_faqs: faqPayload,
      });
      if (sectionsError) throw new Error(getErrorMessage(sectionsError));
      uploadedGalleryKeys.length = 0;

      const removedImages = savedGalleryImages.filter((image) => removedGalleryIds.includes(image.id));
      if (removedImages.length > 0) {
        await Promise.all(removedImages.map((image) => insforge.storage.from(BUCKET).remove(image.image_key)));
      }

      const [galleryResult, faqResult] = await Promise.all([
        insforge.database.from("business_gallery_images").select("id,business_id,image_url,image_key,sort_order").eq("business_id", business.id).order("sort_order", { ascending: true }).limit(10),
        insforge.database.from("business_faqs").select("id,business_id,question,answer,sort_order").eq("business_id", business.id).order("sort_order", { ascending: true }).limit(10),
      ]);
      const sectionsReadError = galleryResult.error ?? faqResult.error;
      if (sectionsReadError) throw new Error(getErrorMessage(sectionsReadError));
      const nextGalleryImages = (galleryResult.data ?? []) as BusinessGalleryImage[];
      const nextFaqs = (faqResult.data ?? []) as BusinessFaq[];
      setSavedGalleryImages(nextGalleryImages);
      setRemovedGalleryIds([]);
      setGalleryFileCount(0);
      setDraftFaqs(nextFaqs.map((faq) => ({ ...faq, localId: faq.id })));
      setMessage("Página pública actualizada.");
      formElement.reset();
      await refresh();
    } catch (saveError) {
      if (!brandingPersisted && uploadedBrandingKeys.length > 0) {
        await Promise.all(uploadedBrandingKeys.map((key) => insforge.storage.from(BUCKET).remove(key)));
      }
      if (uploadedGalleryKeys.length > 0) {
        await Promise.all(uploadedGalleryKeys.map((key) => insforge.storage.from(BUCKET).remove(key)));
      }
      setMessage(getErrorMessage(saveError));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <PageHeader
        actions={
          <>
            <Link className="button-secondary" href={publicUrl} target="_blank"><ExternalLink aria-hidden="true" size={16} />Abrir página</Link>
            <button aria-busy={pending} className="button-primary" disabled={pending} form="public-page-form" type="submit">
              {pending ? <LoadingSpinner label="Guardando cambios" /> : <><Save aria-hidden="true" size={16} />Guardar cambios</>}
            </button>
          </>
        }
        description="Editá la identidad del negocio y comprobá el resultado antes de guardarlo."
        title="Página pública"
      />
      <form method="post" className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[minmax(320px,.78fr)_minmax(440px,1.22fr)] lg:items-start lg:px-10 lg:py-8" id="public-page-form" onSubmit={save}>
        {message ? <div className="lg:col-span-2"><FormMessage type={message.includes("actualizada") ? "success" : "error"}>{message}</FormMessage></div> : null}

        <div className="grid min-w-0 gap-6">
          <section className="surface-section">
          <div className="section-heading-row"><div><h2>Identidad del negocio</h2><p>Tu marca domina la experiencia de reserva.</p></div><Palette aria-hidden="true" className="text-[var(--color-primary)]" size={21} /></div>
          <div className="grid gap-5">
            <TextArea defaultValue={business.description ?? ""} label="Descripción" name="description" onChange={(value) => setDescription(value)} placeholder="Contá qué servicio ofrecés y qué necesita saber quien reserva." required={false} rows={5} />
            <label className="form-label">Color principal<span className="flex items-center gap-3"><input aria-label="Elegir color principal" className="h-12 w-16 cursor-pointer rounded-md border border-[var(--color-line)] bg-white p-1" name="brand_color" onChange={(event) => setBrandColor(event.target.value)} type="color" value={brandColor} /><span className="font-mono text-sm text-[var(--color-ink-soft)]">{brandColor.toUpperCase()}</span></span></label>
            <FileUpload current={business.logo_url} label="Logo" name="logo_file" note="JPG, PNG o WebP. Hasta 2 MB; recomendado 512 × 512 px." />
            <FileUpload current={business.cover_image_url} label="Portada" name="cover_file" note="JPG, PNG o WebP. Hasta 5 MB; recomendado 1600 × 600 px." />
          </div>
          </section>

          <section className="surface-section">
            <div className="section-heading-row"><div><h2>Colores de la página</h2><p>Personalizá cada sección sin cambiar el contenido.</p></div><Palette aria-hidden="true" className="text-[var(--color-primary)]" size={21} /></div>
            <PublicThemeEditor brandColor={brandColor} onChange={setPublicTheme} theme={publicTheme} />
          </section>

          <section className="surface-section">
            <div className="section-heading-row"><div><h2>Contacto y modalidad</h2><p>Indicá cómo se realizan los turnos.</p></div>{serviceMode === "virtual" ? <Video aria-hidden="true" className="text-[var(--color-primary)]" size={21} /> : <MapPinned aria-hidden="true" className="text-[var(--color-primary)]" size={21} />}</div>
            <div className="grid gap-5">
              <fieldset>
                <legend className="form-label">Tipo de atención</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-md border p-4 transition-colors ${serviceMode === "physical" ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "border-[var(--color-line)] bg-white hover:border-[var(--color-line-strong)]"}`}>
                    <input checked={serviceMode === "physical"} className="h-4 w-4 accent-[var(--color-primary)]" name="service_mode" onChange={() => setServiceMode("physical")} type="radio" value="physical" />
                    <span><MapPinned aria-hidden="true" size={20} /><strong className="mt-1 block text-sm text-[var(--color-ink)]">Dirección física</strong></span>
                  </label>
                  <label className={`flex min-h-20 cursor-pointer items-center gap-3 rounded-md border p-4 transition-colors ${serviceMode === "virtual" ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "border-[var(--color-line)] bg-white hover:border-[var(--color-line-strong)]"}`}>
                    <input checked={serviceMode === "virtual"} className="h-4 w-4 accent-[var(--color-primary)]" name="service_mode" onChange={() => setServiceMode("virtual")} type="radio" value="virtual" />
                    <span><Video aria-hidden="true" size={20} /><strong className="mt-1 block text-sm text-[var(--color-ink)]">Servicio virtual</strong></span>
                  </label>
                </div>
              </fieldset>
              <div className="grid gap-2 text-sm">
                <span className="form-label">WhatsApp de contacto</span>
                <p className="text-[var(--color-ink-soft)]">
                  {business.whatsapp_phone ? `+${business.whatsapp_phone}` : "Sin cargar"} · <Link className="font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline" href="/negocio/configuracion">Editar en Configuración</Link>
                </p>
              </div>
              {serviceMode === "physical" ? (
                <>
                  <label className="form-label">Dirección pública<input autoComplete="street-address" className="form-control" maxLength={300} name="public_address" onChange={(event) => setPublicAddress(event.target.value)} placeholder="Av. Corrientes 1234, CABA" value={publicAddress} /></label>
                  <p className="-mt-3 text-xs leading-5 text-[var(--color-ink-muted)]">Usamos esta dirección para generar el mapa de Google Maps.</p>
                </>
              ) : (
                <fieldset>
                  <legend className="form-label">Plataformas disponibles</legend>
                  <div className="grid gap-3">
                    {VIRTUAL_PLATFORM_OPTIONS.map((platform) => {
                      const checked = virtualPlatforms.includes(platform.id);
                      return (
                        <label className={`flex min-h-16 cursor-pointer items-center gap-3 rounded-md border px-4 py-3 transition-colors ${checked ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-line)] bg-white hover:border-[var(--color-line-strong)]"}`} key={platform.id}>
                          <input
                            checked={checked}
                            className="h-4 w-4 accent-[var(--color-primary)]"
                            onChange={() => setVirtualPlatforms((current) => checked ? current.filter((item) => item !== platform.id) : [...current, platform.id])}
                            type="checkbox"
                          />
                          <VirtualPlatformIcon className="h-8 w-8 shrink-0" platform={platform.id} />
                          <strong className="text-sm">{platform.label}</strong>
                        </label>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-ink-muted)]">Podés seleccionar una o varias opciones.</p>
                </fieldset>
              )}
            </div>
          </section>

          <section className="surface-section">
          <div className="section-heading-row"><div><h2>Galería</h2><p>Hasta 10 fotos. Aparecen como carrusel después de la portada.</p></div><Images aria-hidden="true" className="text-[var(--color-primary)]" size={21} /></div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {visibleGalleryImages.map((image, index) => (
              <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-[var(--color-surface-subtle)]" key={image.id}>
                <span aria-label={`Foto ${index + 1} de la galería`} className="absolute inset-0 bg-cover bg-center" role="img" style={{ backgroundImage: `url(${image.image_url})` }} />
                <button aria-label={`Eliminar foto ${index + 1}`} className="absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-md bg-[var(--color-navy)] text-white shadow-md hover:bg-[var(--color-danger)]" onClick={() => setRemovedGalleryIds((ids) => [...ids, image.id])} type="button"><Trash2 aria-hidden="true" size={17} /></button>
              </div>
            ))}
          </div>
          {visibleGalleryImages.length === 0 ? <p className="border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] p-5 text-sm text-[var(--color-ink-soft)]">Todavía no cargaste fotos.</p> : null}
          <label className="mt-4 grid cursor-pointer gap-2 border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] p-4 hover:border-[var(--color-primary)]">
            <strong className="flex items-center gap-2 text-sm"><Upload aria-hidden="true" size={16} />Agregar fotos</strong>
            <small className="leading-5 text-[var(--color-ink-soft)]">JPG, PNG o WebP. Hasta 5 MB cada una. {visibleGalleryImages.length + galleryFileCount}/10 seleccionadas.</small>
            <input
              accept="image/jpeg,image/png,image/webp"
              className="block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-[var(--color-navy)] file:px-3 file:py-2 file:font-semibold file:text-white"
              disabled={visibleGalleryImages.length >= 10}
              multiple
              name="gallery_files"
              onChange={(event) => {
                const count = event.target.files?.length ?? 0;
                if (visibleGalleryImages.length + count > 10) {
                  event.target.value = "";
                  setGalleryFileCount(0);
                  setMessage("La galería admite hasta 10 fotos.");
                  return;
                }
                setGalleryFileCount(count);
                setMessage(null);
              }}
              type="file"
            />
          </label>
          </section>

          <section className="surface-section">
          <div className="section-heading-row"><div><h2>Preguntas frecuentes</h2><p>Hasta 10 preguntas con respuesta.</p></div><CircleHelp aria-hidden="true" className="text-[var(--color-primary)]" size={21} /></div>
          <div className="grid gap-4">
            {draftFaqs.map((faq, index) => (
              <fieldset className="grid gap-3 border-b border-[var(--color-line)] pb-4 last:border-b-0" key={faq.localId}>
                <legend className="sr-only">Pregunta frecuente {index + 1}</legend>
                <div className="flex items-center justify-between gap-3"><strong className="text-sm">Pregunta {index + 1}</strong><button aria-label={`Eliminar pregunta ${index + 1}`} className="button-secondary h-12 w-12 shrink-0 px-0 text-[var(--color-danger)]" onClick={() => setDraftFaqs((current) => current.filter((item) => item.localId !== faq.localId))} type="button"><Trash2 aria-hidden="true" className="h-5 w-5 shrink-0" strokeWidth={2.5} /></button></div>
                <label className="form-label">Pregunta<input className="form-control" maxLength={180} onChange={(event) => setDraftFaqs((current) => current.map((item) => item.localId === faq.localId ? { ...item, question: event.target.value } : item))} placeholder="¿Cómo reservo un turno?" required value={faq.question} /></label>
                <label className="form-label">Respuesta<textarea className="form-control min-h-24 resize-y" maxLength={1200} onChange={(event) => setDraftFaqs((current) => current.map((item) => item.localId === faq.localId ? { ...item, answer: event.target.value } : item))} placeholder="Elegí un servicio, fecha y horario disponible." required value={faq.answer} /></label>
              </fieldset>
            ))}
            {draftFaqs.length === 0 ? <p className="border border-dashed border-[var(--color-line-strong)] bg-[var(--color-surface-subtle)] p-5 text-sm text-[var(--color-ink-soft)]">Todavía no cargaste preguntas.</p> : null}
            <button className="button-secondary w-full" disabled={draftFaqs.length >= 10} onClick={() => setDraftFaqs((current) => [...current, { localId: crypto.randomUUID(), question: "", answer: "", sort_order: -1 }])} type="button"><Plus aria-hidden="true" size={16} />Agregar pregunta</button>
          </div>
          </section>
        </div>

        <div className="min-w-0 self-start lg:sticky lg:top-6">
          <PublicPagePreview
            appointments={appointments}
            availabilitySlots={availabilitySlots}
            brandColor={brandColor}
            business={business}
            description={description}
            faqs={draftFaqs}
            galleryImages={visibleGalleryImages}
            publicAddress={publicAddress}
            publicTheme={publicTheme}
            serviceMode={serviceMode}
            services={services}
            virtualPlatforms={virtualPlatforms}
            whatsappPhone={business.whatsapp_phone ?? ""}
          />
        </div>
      </form>
    </>
  );
}

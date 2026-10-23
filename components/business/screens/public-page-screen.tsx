"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { ExternalLink, Palette, Save } from "lucide-react";
import { FormMessage, LoadingSpinner } from "@/components/ui";
import type { BusinessFaq, BusinessGalleryImage } from "@/lib/citadely-db";
import { getErrorMessage } from "@/lib/auth";
import { insforge } from "@/lib/insforge";
import { normalizePublicAddress, normalizeWhatsAppPhone } from "@/lib/public-profile";
import { DEFAULT_BRAND_COLOR, normalizePublicTheme } from "@/lib/public-theme";
import { revalidatePublicPage } from "@/lib/revalidate-public-page";
import { BUSINESS_ASSETS_BUCKET, getFormFile, uploadImage } from "@/lib/upload-image";
import { normalizeVirtualPlatforms, type ServiceMode, type VirtualPlatform } from "@/lib/virtual-service";
import { ContactSection } from "../public-page/contact-section";
import { FaqSection, type DraftFaq } from "../public-page/faq-section";
import { GallerySection } from "../public-page/gallery-section";
import { IdentitySection } from "../public-page/identity-section";
import { PublicPagePreview } from "../public-page-preview";
import { PublicThemeEditor } from "../public-theme-editor";
import { useWorkspace } from "../workspace-context";
import { PageHeader } from "../workspace-ui";

export function PublicPageScreen() {
  const { appointments, availabilitySlots, business, galleryImages, faqs, publicUrl, refresh, services } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [description, setDescription] = useState(business.description ?? "");
  const [brandColor, setBrandColor] = useState(business.brand_color ?? DEFAULT_BRAND_COLOR);
  const [publicTheme, setPublicTheme] = useState(() => normalizePublicTheme(business.public_theme));
  const [publicAddress, setPublicAddress] = useState(business.public_address ?? "");
  const [whatsappPhone, setWhatsappPhone] = useState(business.whatsapp_phone ?? "");
  const [serviceMode, setServiceMode] = useState<ServiceMode>(business.service_mode ?? "physical");
  const [virtualPlatforms, setVirtualPlatforms] = useState<VirtualPlatform[]>(normalizeVirtualPlatforms(business.virtual_platforms));
  const [savedGalleryImages, setSavedGalleryImages] = useState(galleryImages);
  const [removedGalleryIds, setRemovedGalleryIds] = useState<string[]>([]);
  const [galleryFileCount, setGalleryFileCount] = useState(0);
  const [draftFaqs, setDraftFaqs] = useState<DraftFaq[]>(
    faqs.map((faq) => ({ ...faq, localId: faq.id })),
  );
  const visibleGalleryImages = savedGalleryImages.filter((image) => !removedGalleryIds.includes(image.id));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const logo = getFormFile(form, "logo_file");
    const cover = getFormFile(form, "cover_file");
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
      const normalizedPhone = normalizeWhatsAppPhone(whatsappPhone);
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
        whatsapp_phone: normalizedPhone,
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
        await Promise.all(replacedBrandingKeys.map((key) => insforge.storage.from(BUSINESS_ASSETS_BUCKET).remove(key)));
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
        await Promise.all(removedImages.map((image) => insforge.storage.from(BUSINESS_ASSETS_BUCKET).remove(image.image_key)));
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
      void revalidatePublicPage();
      formElement.reset();
      await refresh();
    } catch (saveError) {
      if (!brandingPersisted && uploadedBrandingKeys.length > 0) {
        await Promise.all(uploadedBrandingKeys.map((key) => insforge.storage.from(BUSINESS_ASSETS_BUCKET).remove(key)));
      }
      if (uploadedGalleryKeys.length > 0) {
        await Promise.all(uploadedGalleryKeys.map((key) => insforge.storage.from(BUSINESS_ASSETS_BUCKET).remove(key)));
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
          <IdentitySection brandColor={brandColor} business={business} onBrandColorChange={setBrandColor} onDescriptionChange={setDescription} />

          <section className="surface-section">
            <div className="section-heading-row"><div><h2>Colores de la página</h2><p>Personalizá cada sección sin cambiar el contenido.</p></div><Palette aria-hidden="true" className="text-primary" size={21} /></div>
            <PublicThemeEditor brandColor={brandColor} onChange={setPublicTheme} theme={publicTheme} />
          </section>

          <ContactSection
            onPublicAddressChange={setPublicAddress}
            onServiceModeChange={setServiceMode}
            onVirtualPlatformsChange={setVirtualPlatforms}
            onWhatsappPhoneChange={setWhatsappPhone}
            publicAddress={publicAddress}
            serviceMode={serviceMode}
            virtualPlatforms={virtualPlatforms}
            whatsappPhone={whatsappPhone}
          />

          <GallerySection
            fileCount={galleryFileCount}
            images={visibleGalleryImages}
            onFileCountChange={setGalleryFileCount}
            onMessage={setMessage}
            onRemove={(id) => setRemovedGalleryIds((ids) => [...ids, id])}
          />

          <FaqSection faqs={draftFaqs} onChange={setDraftFaqs} />
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
            whatsappPhone={whatsappPhone}
          />
        </div>
      </form>
    </>
  );
}

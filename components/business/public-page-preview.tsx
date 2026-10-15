"use client";

import { useRef, useState, type CSSProperties } from "react";
import { PublicBookingCalendar } from "@/components/public-booking-calendar";
import { PublicBusinessInfo, WhatsAppIcon } from "@/components/public-business-info";
import { PublicEditorialHero } from "@/components/public-editorial-hero";
import { PublicFaqs } from "@/components/public-faqs";
import { PublicServiceCarousel } from "@/components/public-service-carousel";
import { PublicGalleryCarousel } from "@/components/public-gallery-carousel";
import { LogoMark } from "@/components/ui";
import {
  buildBookingSlots,
  formatCurrency,
  type Appointment,
  type Business,
  type BusinessGalleryImage,
  type Service,
  type ServiceAvailabilitySlot,
} from "@/lib/citadely-db";
import { getPublicAvailabilitySummary, getWhatsAppUrl, normalizeWhatsAppPhone } from "@/lib/public-profile";
import { resolveSectionColors, sectionThemeStyle, type PublicTheme } from "@/lib/public-theme";
import { useWorkspace } from "./workspace-context";
import type { ServiceMode, VirtualPlatform } from "@/lib/virtual-service";

type PreviewFaq = {
  localId: string;
  question: string;
  answer: string;
};

export function PublicPagePreview({
  appointments,
  availabilitySlots,
  brandColor,
  business,
  description,
  faqs,
  galleryImages,
  publicAddress,
  publicTheme,
  serviceMode,
  services,
  virtualPlatforms,
  whatsappPhone,
}: {
  appointments: Appointment[];
  availabilitySlots: ServiceAvailabilitySlot[];
  brandColor: string;
  business: Business;
  description: string;
  faqs: PreviewFaq[];
  galleryImages: BusinessGalleryImage[];
  publicAddress: string;
  publicTheme: PublicTheme;
  serviceMode: ServiceMode;
  services: Service[];
  virtualPlatforms: VirtualPlatform[];
  whatsappPhone: string;
}) {
  const { publicUrl } = useWorkspace();
  const publishedServices = services.filter((service) => service.is_active);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [selectedDateKey, setSelectedDateKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const calendarHeadingRef = useRef<HTMLHeadingElement>(null);
  const selectedService = publishedServices.find((service) => service.id === selectedServiceId) ?? null;
  const bookingSlots = buildBookingSlots(appointments, selectedService, availabilitySlots, business.timezone);
  const selectedSlotData = bookingSlots.find((slot) => slot.startsAt === selectedSlot);
  const availability = getPublicAvailabilitySummary(availabilitySlots, appointments, business.timezone);
  const hasWhatsapp = Boolean(normalizeWhatsAppPhone(whatsappPhone));
  const whatsappUrl = getWhatsAppUrl(whatsappPhone, `Hola ${business.name}, quisiera hacer una consulta.`);
  const headerStyle = sectionThemeStyle("header", publicTheme, brandColor);
  const heroStyle = sectionThemeStyle("hero", publicTheme, brandColor);
  const servicesStyle = sectionThemeStyle("services", publicTheme, brandColor);
  const bookingStyle = sectionThemeStyle("booking", publicTheme, brandColor);
  const servicesColors = resolveSectionColors("services", publicTheme, brandColor);
  const headerColors = resolveSectionColors("header", publicTheme, brandColor);
  const bookingColors = resolveSectionColors("booking", publicTheme, brandColor);

  return (
    <section aria-label="Vista previa de la página pública" className="overflow-hidden border border-line bg-white shadow-raised">
      <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-ink-muted">Vista previa</span>
        <span className="truncate text-xs text-ink-muted">{publicUrl.replace(/^https?:\/\//, "")}</span>
      </div>

      <div
        aria-label="Contenido desplazable de la vista previa"
        className="h-[720px] overflow-y-auto overscroll-contain bg-canvas [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin]"
        style={{ "--booking-brand": brandColor } as CSSProperties}
        tabIndex={0}
      >
        <header className={`sticky top-0 z-20 bg-navy text-white shadow-md ${headerStyle ? "public-theme-active public-theme-header" : ""}`} style={headerStyle}>
          <div className="flex min-h-16 flex-wrap items-center justify-between gap-2 px-4 py-3 sm:flex-nowrap sm:px-5">
            <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-auto">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-white/20 bg-white">
                {business.logo_url ? (
                  <span aria-label={`Logo de ${business.name}`} className="block h-full w-full bg-contain bg-center bg-no-repeat" role="img" style={{ backgroundImage: `url(${business.logo_url})` }} />
                ) : (
                  <span className="font-display font-semibold" style={{ color: headerColors.accent }}>{business.name.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <strong className="truncate text-sm">{business.name}</strong>
            </div>
            <div className="flex w-full items-center justify-end gap-2 text-xs sm:w-auto">
              <span className="inline-flex min-h-9 items-center whitespace-nowrap rounded-md px-3 font-semibold text-white" style={{ backgroundColor: headerColors.accent, color: headerStyle ? headerColors.accentInk : undefined }}>Reservar turno</span>
              {hasWhatsapp ? <span aria-label="Vista previa del acceso a WhatsApp" className="grid h-9 w-9 place-items-center rounded-md bg-whatsapp text-white"><WhatsAppIcon className="h-4 w-4" /></span> : null}
            </div>
          </div>
        </header>

        <PublicEditorialHero
          address={publicAddress}
          businessName={business.name}
          compact
          coverImageUrl={business.cover_image_url}
          description={description}
          logoUrl={business.logo_url}
          schedule={availability.schedule}
          serviceMode={serviceMode}
          virtualPlatforms={virtualPlatforms}
          themeStyle={heroStyle}
        />

        <section className={`bg-white px-3 py-8 sm:px-9 ${bookingStyle ? "public-theme-active public-theme-booking" : ""}`} style={bookingStyle}>
          <div className={`public-service-section ${servicesStyle ? "public-theme-active public-theme-services" : ""}`} style={{ ...servicesStyle, "--booking-brand": servicesColors.accent, "--booking-brand-foreground": servicesColors.accentInk } as CSSProperties}>
            <div className="flex items-center gap-3"><span aria-hidden="true" className="public-booking-step">01</span><h3 className="font-display text-2xl font-semibold tracking-[-0.035em]">Servicios</h3></div>
            {publishedServices.length > 0 ? (
              <div className="mt-4">
                <PublicServiceCarousel brandColor={servicesColors.accent} compact currency={business.currency} onSelect={(id) => {
                  if (id !== selectedServiceId) {
                    setSelectedServiceId(id);
                    setSelectedDateKey("");
                    setSelectedSlot("");
                  }
                  requestAnimationFrame(() => calendarHeadingRef.current?.focus());
                }} selectedServiceId={selectedServiceId} services={publishedServices} />
              </div>
            ) : <p className="mt-4 text-sm text-ink-soft">No hay servicios publicados.</p>}
          </div>

          <div className="mt-5 grid gap-5">
            <PublicBookingCalendar
              compact
              headingRef={calendarHeadingRef}
              key={selectedServiceId || "empty"}
              onDateChange={setSelectedDateKey}
              onSlotChange={setSelectedSlot}
              selectedDateKey={selectedDateKey}
              selectedSlot={selectedSlot}
              serviceSelected={Boolean(selectedService)}
              slots={bookingSlots}
              timeZone={business.timezone}
            />

            <aside className="public-theme-card h-fit border border-line bg-white p-5">
              <div className="flex items-center gap-3"><span aria-hidden="true" className="public-booking-step">03</span><h3 className="font-display text-xl font-semibold tracking-[-0.03em]">Confirmá la reserva</h3></div>
              <div className="mt-4 bg-surface-subtle p-4">
                <p className="font-semibold">{selectedService?.name ?? "Sin servicio seleccionado"}</p>
                {selectedService ? <p className="mt-1 text-xs text-ink-soft">{selectedService.duration_minutes} min · {formatCurrency(selectedService.price_cents, business.currency)}</p> : null}
                {selectedSlotData ? <p className="mt-1 text-xs text-ink-soft">{selectedSlotData.label}</p> : null}
              </div>
              <span className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md text-xs font-bold text-white" style={{ backgroundColor: bookingColors.accent, color: bookingStyle ? bookingColors.accentInk : undefined }}>Confirmar reserva</span>
            </aside>
          </div>
        </section>

        {galleryImages.length > 0 ? <PublicGalleryCarousel businessName={business.name} compact images={galleryImages} themeStyle={sectionThemeStyle("gallery", publicTheme, brandColor)} /> : null}
        <PublicBusinessInfo address={publicAddress} businessName={business.name} compact dateCount={availability.dateCount} schedule={availability.schedule} serviceMode={serviceMode} themeStyle={sectionThemeStyle("info", publicTheme, brandColor)} virtualPlatforms={virtualPlatforms} whatsappPhone={whatsappPhone} />
        <PublicFaqs compact contactUrl={whatsappUrl} faqs={faqs.filter((faq) => faq.question && faq.answer).map((faq) => ({ ...faq, id: faq.localId }))} themeStyle={sectionThemeStyle("faq", publicTheme, brandColor)} />

        <footer className="flex items-center justify-between gap-3 border-t border-line bg-white px-6 py-5 text-xs text-ink-soft sm:px-9">
          <span>{business.name}</span>
          <span className="origin-right scale-75"><LogoMark linked={false} /></span>
        </footer>
      </div>
    </section>
  );
}

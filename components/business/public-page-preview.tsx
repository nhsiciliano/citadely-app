import type { CSSProperties } from "react";
import { ArrowRight } from "lucide-react";
import { PublicBusinessInfo, WhatsAppIcon } from "@/components/public-business-info";
import { PublicGalleryCarousel } from "@/components/public-gallery-carousel";
import { LogoMark } from "@/components/ui";
import {
  buildBookingSlots,
  formatCurrency,
  getBookingPaymentLabel,
  type Appointment,
  type Business,
  type BusinessGalleryImage,
  type Service,
  type ServiceAvailabilitySlot,
} from "@/lib/citadely-db";
import { getPublicAvailabilitySummary, normalizeWhatsAppPhone } from "@/lib/public-profile";
import { getBusinessPublicUrl } from "@/lib/urls";
import type { ServiceMode, VirtualPlatform } from "@/lib/virtual-service";

type PreviewFaq = {
  localId: string;
  question: string;
  answer: string;
};

function formatCalendarDate(dateKey: string) {
  const [, month, day] = dateKey.split("-");
  return `${day}/${month}`;
}

export function PublicPagePreview({
  appointments,
  availabilitySlots,
  brandColor,
  business,
  description,
  faqs,
  galleryImages,
  publicAddress,
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
  serviceMode: ServiceMode;
  services: Service[];
  virtualPlatforms: VirtualPlatform[];
  whatsappPhone: string;
}) {
  const publishedServices = services.filter((service) => service.is_active);
  const selectedService = publishedServices[0] ?? null;
  const availableSlots = buildBookingSlots(appointments, selectedService, availabilitySlots).filter((slot) => slot.available);
  const calendarDays = Array.from(new Map(availableSlots.map((slot) => [slot.dateKey, slot])).values()).slice(0, 7);
  const availability = getPublicAvailabilitySummary(availabilitySlots, appointments);
  const hasWhatsapp = Boolean(normalizeWhatsAppPhone(whatsappPhone));

  return (
    <section aria-label="Vista previa de la página pública" className="overflow-hidden border border-[var(--color-line)] bg-white shadow-[var(--shadow-raised)]">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--color-line)] px-4 py-3">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">Vista previa</span>
        <span className="truncate text-xs text-[var(--color-ink-muted)]">{getBusinessPublicUrl(business.slug).replace(/^https?:\/\//, "")}</span>
      </div>

      <div
        aria-label="Contenido desplazable de la vista previa"
        className="h-[720px] overflow-y-auto overscroll-contain bg-[var(--color-canvas)] [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin]"
        style={{ "--booking-brand": brandColor } as CSSProperties}
        tabIndex={0}
      >
        <header className="sticky top-0 z-20 bg-[var(--color-navy)] text-white shadow-md">
          <div className="flex min-h-16 items-center justify-between gap-4 px-5">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-white/20 bg-white">
                {business.logo_url ? (
                  <span aria-label={`Logo de ${business.name}`} className="block h-full w-full bg-contain bg-center bg-no-repeat" role="img" style={{ backgroundImage: `url(${business.logo_url})` }} />
                ) : (
                  <span className="font-display font-semibold" style={{ color: brandColor }}>{business.name.slice(0, 1).toUpperCase()}</span>
                )}
              </span>
              <strong className="truncate text-sm">{business.name}</strong>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex min-h-9 items-center rounded-md px-4 font-semibold text-white" style={{ backgroundColor: brandColor }}>Reservar turno</span>
              {hasWhatsapp ? <span aria-label="Vista previa del acceso a WhatsApp" className="grid h-9 w-9 place-items-center rounded-md bg-[#148b45] text-white"><WhatsAppIcon className="h-4 w-4" /></span> : null}
            </div>
          </div>
        </header>

        <div
          className="relative isolate flex min-h-[340px] items-end overflow-hidden bg-cover bg-center px-6 py-9 sm:px-9"
          style={{ backgroundColor: brandColor, backgroundImage: business.cover_image_url ? `url(${business.cover_image_url})` : undefined }}
        >
          {business.cover_image_url ? <span aria-hidden="true" className="absolute inset-0 -z-10 bg-[rgba(4,15,31,.68)]" /> : null}
          {!business.cover_image_url ? <span aria-hidden="true" className="absolute right-8 top-1/2 -z-10 -translate-y-1/2 font-display text-9xl font-semibold leading-none text-white/10">{business.name.slice(0, 1).toUpperCase()}</span> : null}
          <div className="max-w-xl text-white">
            <h2 className="font-display text-4xl font-semibold leading-[.94] tracking-[-0.04em] sm:text-5xl">{business.name}</h2>
            {description ? <p className="mt-4 line-clamp-4 max-w-[62ch] text-sm leading-6 text-white/80">{description}</p> : null}
            <span className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md bg-white px-4 text-xs font-bold text-[var(--color-navy)]">Ver servicios<ArrowRight aria-hidden="true" size={15} /></span>
          </div>
        </div>

        <PublicBusinessInfo address={publicAddress} businessName={business.name} compact dateCount={availability.dateCount} schedule={availability.schedule} serviceMode={serviceMode} virtualPlatforms={virtualPlatforms} whatsappPhone={whatsappPhone} />

        {galleryImages.length > 0 ? <PublicGalleryCarousel businessName={business.name} compact images={galleryImages} /> : null}

        {faqs.length > 0 ? (
          <section className="grid gap-5 border-b border-[var(--color-line)] bg-[var(--color-surface-subtle)] px-6 py-8 sm:grid-cols-[.65fr_1.35fr] sm:px-9">
            <h3 className="font-display text-2xl font-semibold tracking-[-0.035em]">Preguntas frecuentes</h3>
            <div className="border-t border-[var(--color-line-strong)]">
              {faqs.map((faq) => (
                <div className="border-b border-[var(--color-line-strong)] bg-white px-4 py-4" key={faq.localId}>
                  <p className="flex justify-between gap-3 text-sm font-semibold"><span>{faq.question || "Pregunta sin completar"}</span><span aria-hidden="true" className="text-[var(--booking-brand)]">+</span></p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="bg-[var(--color-canvas)] px-6 py-8 sm:px-9">
          <div className="border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-surface)]">
            <h3 className="font-display text-2xl font-semibold tracking-[-0.035em]">Elegí un servicio</h3>
            {publishedServices.length > 0 ? (
              <div className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2">
                {publishedServices.map((service) => (
                  <article className="grid min-h-48 min-w-[82%] snap-start grid-cols-[36%_1fr] overflow-hidden rounded-md bg-[var(--color-navy)] text-white sm:min-w-[62%]" key={service.id}>
                    {service.image_url ? (
                      <span aria-label={`Imagen de ${service.name}`} className="h-full bg-cover bg-center" role="img" style={{ backgroundImage: `url(${service.image_url})` }} />
                    ) : (
                      <span className="grid h-full place-items-center bg-[var(--color-navy-raised)] text-4xl font-semibold text-white/70">{service.name.slice(0, 1).toUpperCase()}</span>
                    )}
                    <span className="flex min-w-0 flex-col p-4">
                      <strong className="text-lg tracking-[-0.03em]">{service.name}</strong>
                      <span className="mt-2 text-xs text-white/70">{getBookingPaymentLabel(service, business.currency)}</span>
                      <span className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-white/15 pt-3 text-xs font-semibold">
                        <span>{formatCurrency(service.price_cents, business.currency)}</span>
                        <span className="text-white/70">{service.duration_minutes} min</span>
                      </span>
                    </span>
                  </article>
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-[var(--color-ink-soft)]">No hay servicios publicados.</p>}
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
            <section className="border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-surface)]">
              <h3 className="font-display text-xl font-semibold tracking-[-0.03em]">Calendario</h3>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {calendarDays.map((day, index) => (
                  <span className={`grid min-h-20 place-items-center rounded-md border px-2 py-3 text-center ${index === 0 ? "border-[var(--booking-brand)] bg-[var(--booking-brand)] text-white" : "border-[var(--color-line)]"}`} key={day.dateKey}>
                    <span className="text-xs font-semibold capitalize opacity-70">{day.weekdayLabel}</span>
                    <strong>{formatCalendarDate(day.dateKey)}</strong>
                  </span>
                ))}
                {calendarDays.length === 0 ? <p className="col-span-full text-sm text-[var(--color-ink-soft)]">Sin horarios disponibles.</p> : null}
              </div>
              {availableSlots.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{availableSlots.slice(0, 6).map((slot) => <span className="rounded-md border border-[var(--color-line)] px-3 py-2 text-xs font-semibold" key={slot.startsAt}>{slot.timeLabel}</span>)}</div> : null}
            </section>

            <aside className="h-fit border border-[var(--color-line)] bg-white p-5 shadow-[var(--shadow-raised)]">
              <h3 className="font-display text-xl font-semibold tracking-[-0.03em]">Confirmá</h3>
              <div className="mt-4 bg-[var(--color-surface-subtle)] p-4">
                <p className="font-semibold">{selectedService?.name ?? "Sin servicio seleccionado"}</p>
                {selectedService ? <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{selectedService.duration_minutes} min · {formatCurrency(selectedService.price_cents, business.currency)}</p> : null}
              </div>
              <span className="mt-4 inline-flex min-h-10 w-full items-center justify-center rounded-md text-xs font-bold text-white" style={{ backgroundColor: brandColor }}>Confirmar reserva</span>
            </aside>
          </div>
        </section>

        <footer className="flex items-center justify-between gap-3 border-t border-[var(--color-line)] bg-white px-6 py-5 text-xs text-[var(--color-ink-soft)] sm:px-9">
          <span>{business.name}</span>
          <span className="origin-right scale-75"><LogoMark linked={false} /></span>
        </footer>
      </div>
    </section>
  );
}

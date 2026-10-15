import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentStatusBanner } from "@/components/payment-status-banner";
import { PublicBookingForm } from "@/components/public-booking-form";
import { PublicBusinessInfo, WhatsAppIcon } from "@/components/public-business-info";
import { PublicEditorialHero } from "@/components/public-editorial-hero";
import { PublicFaqs } from "@/components/public-faqs";
import { PublicGalleryCarousel } from "@/components/public-gallery-carousel";
import { LogoMark } from "@/components/ui";
import type { PublicBusiness } from "@/lib/citadely-db";
import { getPublicPageData } from "@/lib/public-page-data";
import { formatWhatsAppPhone, getPublicAvailabilitySummary, getWhatsAppUrl } from "@/lib/public-profile";
import { DEFAULT_BRAND_COLOR, normalizePublicTheme, resolveSectionColors, sectionThemeStyle } from "@/lib/public-theme";
import { INDEX_ROBOTS, NO_INDEX_ROBOTS, SITE_ORIGIN, serializeJsonLd } from "@/lib/seo";
import { getBusinessPublicUrl } from "@/lib/urls";

type PublicPageProps = {
  params: Promise<{ slug: string }>;
};

// The page is rendered once and cached (ISR) for 60 s; prices, slots and occupancy come from the
// per-business data cache tagged in lib/public-page-data.ts. force-static is required: without it
// the route renders on every request. Nothing here reads cookies or headers, and the ?pago banner
// is read in the browser (PaymentStatusBanner).
export const revalidate = 60;
export const dynamic = "force-static";

function getBusinessDescription(business: PublicBusiness) {
  const fallback = `Reservá un turno en ${business.name}. Consultá servicios, fechas y horarios disponibles online.`;
  const description = business.description?.trim() || fallback;
  return description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
}

export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicPageData(slug);

  if (!data) {
    return {
      title: "Página no disponible",
    };
  }

  const { business, bookable } = data;
  const title = `${business.name} | Turnos online`;
  const description = getBusinessDescription(business);
  const canonicalUrl = getBusinessPublicUrl(business.slug);
  const images = business.cover_image_url
    ? [{ url: business.cover_image_url, alt: `Portada de ${business.name}` }]
    : business.logo_url
      ? [{ url: business.logo_url, alt: `Logo de ${business.name}` }]
      : [{ url: "/opengraph-image", alt: "Citadely — Agenda y turnos online para negocios" }];

  return {
    title,
    description,
    robots: bookable ? INDEX_ROBOTS : NO_INDEX_ROBOTS,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      type: "website",
      locale: "es_AR",
      title,
      description,
      url: canonicalUrl,
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

export default async function PublicBookingPage({ params }: PublicPageProps) {
  const { slug } = await params;
  const data = await getPublicPageData(slug);
  if (!data) notFound();
  const { business, bookable, services, availabilitySlots, galleryImages, faqs } = data;
  const brandColor = business.brand_color || DEFAULT_BRAND_COLOR;
  const publicTheme = normalizePublicTheme(business.public_theme);
  const headerStyle = sectionThemeStyle("header", publicTheme, brandColor);
  const headerColors = resolveSectionColors("header", publicTheme, brandColor);
  const availability = getPublicAvailabilitySummary(availabilitySlots, [], business.timezone);
  const whatsappUrl = getWhatsAppUrl(business.whatsapp_phone, `Hola ${business.name}, quisiera hacer una consulta.`);
  const canonicalUrl = getBusinessPublicUrl(business.slug);
  const businessStructuredData = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${canonicalUrl}#business`,
    name: business.name,
    url: canonicalUrl,
    description: getBusinessDescription(business),
    ...(business.category ? { keywords: business.category } : {}),
    ...(business.cover_image_url || business.logo_url
      ? { image: [business.cover_image_url, business.logo_url].filter(Boolean) }
      : {}),
    ...(formatWhatsAppPhone(business.whatsapp_phone)
      ? { telephone: formatWhatsAppPhone(business.whatsapp_phone) }
      : {}),
    ...(business.public_address ? { address: business.public_address } : {}),
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: `Servicios de ${business.name}`,
      itemListElement: services.map((service) => ({
        "@type": "Offer",
        price: String(service.price_cents / 100),
        priceCurrency: business.currency || "ARS",
        itemOffered: {
          "@type": "Service",
          name: service.name,
          ...(service.description ? { description: service.description } : {}),
        },
      })),
    },
    potentialAction: {
      "@type": "ReserveAction",
      target: `${canonicalUrl}#reservar`,
    },
  };
  const faqStructuredData = faqs.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: { "@type": "Answer", text: faq.answer },
        })),
      }
    : null;

  return (
    <main className="min-h-screen bg-canvas text-ink" style={{ "--booking-brand": brandColor } as CSSProperties}>
      <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(businessStructuredData) }} type="application/ld+json" />
      {faqStructuredData ? <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqStructuredData) }} type="application/ld+json" /> : null}
      <a className="skip-link" href="#reservar">Ir a reservar</a>
      <header className={`bg-navy text-white ${headerStyle ? "public-theme-active public-theme-header" : ""}`} style={headerStyle}>
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-3 sm:flex-nowrap sm:px-8 sm:py-4 lg:px-10">
          <div className="flex min-w-0 basis-full items-center gap-3 sm:basis-auto sm:flex-1">
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-white/20 bg-white">
              {business.logo_url ? (
                <span aria-label={`Logo de ${business.name}`} className="block h-full w-full bg-contain bg-center bg-no-repeat" role="img" style={{ backgroundImage: `url(${business.logo_url})` }} />
              ) : (
                <span className="font-display text-lg font-semibold" style={{ color: headerColors.accent }}>{business.name.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <p className="truncate text-sm font-semibold sm:text-base">{business.name}</p>
          </div>
          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
            <a className="inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-bold text-white sm:px-5" href="#reservar" style={{ backgroundColor: headerColors.accent, color: headerStyle ? headerColors.accentInk : undefined }}>Reservar turno</a>
            {whatsappUrl ? <a aria-label={`Contactar a ${business.name} por WhatsApp`} className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-whatsapp text-white hover:bg-whatsapp-strong" href={whatsappUrl} rel="noreferrer" target="_blank"><WhatsAppIcon /></a> : null}
          </div>
        </div>
      </header>

      <PublicEditorialHero
        address={business.public_address}
        businessName={business.name}
        coverImageUrl={business.cover_image_url}
        description={business.description}
        logoUrl={business.logo_url}
        schedule={availability.schedule}
        serviceMode={business.service_mode}
        virtualPlatforms={business.virtual_platforms}
        themeStyle={sectionThemeStyle("hero", publicTheme, brandColor)}
      />

      <section className="bg-white"><div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-12 lg:px-10 lg:py-14">
          <PaymentStatusBanner />

        <div id="reservar">
          {bookable ? (
            <PublicBookingForm availabilitySlots={availabilitySlots} business={business} services={services} />
          ) : (
            <BookingUnavailable businessName={business.name} whatsappUrl={whatsappUrl} />
          )}
        </div>
      </div></section>

      {galleryImages.length > 0 ? <PublicGalleryCarousel businessName={business.name} images={galleryImages} themeStyle={sectionThemeStyle("gallery", publicTheme, brandColor)} /> : null}
      <PublicBusinessInfo address={business.public_address} businessName={business.name} dateCount={availability.dateCount} schedule={availability.schedule} serviceMode={business.service_mode} themeStyle={sectionThemeStyle("info", publicTheme, brandColor)} virtualPlatforms={business.virtual_platforms} whatsappPhone={business.whatsapp_phone} />
      <PublicFaqs contactUrl={whatsappUrl} faqs={faqs} themeStyle={sectionThemeStyle("faq", publicTheme, brandColor)} />

      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-sm text-ink-soft sm:px-8 lg:px-10">
          <p>{business.name}</p>
          <Link className="origin-right scale-90 font-semibold hover:text-primary" href={SITE_ORIGIN} aria-label="Gestionado con Citadely"><LogoMark linked={false} /></Link>
        </div>
      </footer>
    </main>
  );
}

function BookingUnavailable({ businessName, whatsappUrl }: { businessName: string; whatsappUrl: string | null }) {
  return (
    <section className="grid max-w-2xl gap-4" aria-labelledby="reservas-no-disponibles">
      <h2 id="reservas-no-disponibles" className="font-display text-3xl font-semibold tracking-[-0.04em]">
        Reservas no disponibles
      </h2>
      <p className="text-ink-soft">
        {businessName} no está recibiendo reservas online por el momento.
      </p>
      {whatsappUrl ? (
        <a className="button-secondary w-fit" href={whatsappUrl} rel="noopener noreferrer" target="_blank">
          Consultar por WhatsApp
        </a>
      ) : null}
    </section>
  );
}

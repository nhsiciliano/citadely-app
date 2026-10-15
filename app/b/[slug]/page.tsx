import { cache, type CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicBookingForm } from "@/components/public-booking-form";
import { PublicBusinessInfo, WhatsAppIcon } from "@/components/public-business-info";
import { PublicEditorialHero } from "@/components/public-editorial-hero";
import { PublicFaqs } from "@/components/public-faqs";
import { PublicGalleryCarousel } from "@/components/public-gallery-carousel";
import { LogoMark } from "@/components/ui";
import {
  PUBLIC_BUSINESS_COLUMNS,
  type BusinessFaq,
  type BusinessGalleryImage,
  type PublicBusiness,
  type Service,
  type ServiceAvailabilitySlot,
} from "@/lib/citadely-db";
import { insforgePublic as insforge } from "@/lib/insforge-public";
import { formatWhatsAppPhone, getPublicAvailabilitySummary, getWhatsAppUrl } from "@/lib/public-profile";
import { DEFAULT_BRAND_COLOR, normalizePublicTheme, resolveSectionColors, sectionThemeStyle } from "@/lib/public-theme";
import { getPublicBookingWindow, PUBLIC_SLOT_LIMIT } from "@/lib/booking-window";
import { INDEX_ROBOTS, NO_INDEX_ROBOTS, SITE_ORIGIN, serializeJsonLd } from "@/lib/seo";
import { getBusinessPublicUrl } from "@/lib/urls";

type PublicPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pago?: string }>;
};

const getPublicBusiness = cache(async (slug: string) => {
  const { data, error } = await insforge.database
    .from("businesses")
    .select(PUBLIC_BUSINESS_COLUMNS)
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!error) return (data as PublicBusiness | null) ?? null;

  console.error("Public business lookup failed", { code: error.code, message: error.message });
  const legacyColumns = PUBLIC_BUSINESS_COLUMNS.split(",").filter((column) => column !== "public_theme").join(",");
  const legacy = await insforge.database
    .from("businesses")
    .select(legacyColumns)
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();
  if (legacy.error) {
    console.error("Public business fallback failed", { code: legacy.error.code, message: legacy.error.message });
    return null;
  }
  const legacyBusiness = legacy.data as Omit<PublicBusiness, "public_theme"> | null;
  return legacyBusiness ? { ...legacyBusiness, public_theme: {} } : null;
});

// Reservas habilitadas según la regla de la base. Ante un error se cierra la reserva por seguridad.
const getBookingAccess = cache(async (businessId: string) => {
  const { data, error } = await insforge.database.rpc("business_has_booking_access", {
    target_business_id: businessId,
  });
  if (error) {
    console.error("Booking access lookup failed", { message: error.message });
    return false;
  }
  return data === true;
});

function getBusinessDescription(business: PublicBusiness) {
  const fallback = `Reservá un turno en ${business.name}. Consultá servicios, fechas y horarios disponibles online.`;
  const description = business.description?.trim() || fallback;
  return description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
}

export async function generateMetadata({ params }: PublicPageProps): Promise<Metadata> {
  const { slug } = await params;
  const business = await getPublicBusiness(slug);

  if (!business) {
    return {
      title: "Página no disponible",
    };
  }

  const bookable = await getBookingAccess(business.id);
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

export default async function PublicBookingPage({ params, searchParams }: PublicPageProps) {
  const { slug } = await params;
  const { pago } = await searchParams;
  const business = await getPublicBusiness(slug);
  if (!business) notFound();

  const bookingWindow = getPublicBookingWindow();
  const [bookable, { data: serviceRows }, { data: availabilityRows }, { data: galleryRows }, { data: faqRows }] = await Promise.all([
    getBookingAccess(business.id),
    insforge.database.from("services").select("*").eq("business_id", business.id).eq("is_active", true).order("created_at", { ascending: false }),
    insforge.database
      .from("service_availability_slots")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .gte("starts_at", bookingWindow.from)
      .lt("starts_at", bookingWindow.to)
      .order("starts_at", { ascending: true })
      .limit(PUBLIC_SLOT_LIMIT),
    insforge.database
      .from("business_gallery_images")
      .select("id,business_id,image_url,image_key,sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .limit(10),
    insforge.database
      .from("business_faqs")
      .select("id,business_id,question,answer,sort_order")
      .eq("business_id", business.id)
      .order("sort_order", { ascending: true })
      .limit(10),
  ]);

  const services = (serviceRows ?? []) as Service[];
  const rawSlots = (availabilityRows ?? []) as ServiceAvailabilitySlot[];
  const occupancyResult = rawSlots.length
    ? await insforge.database.rpc("get_public_slot_occupancy", {
        p_business_id: business.id,
        p_slot_ids: rawSlots.map((slot) => slot.id),
      })
    : { data: [], error: null };
  const occupancy = new Map(((occupancyResult.data ?? []) as { slot_id: string; booked: number; blocked_by_other_service: boolean }[])
    .map((row) => [row.slot_id, row]));
  const availabilitySlots = occupancyResult.error ? [] : rawSlots.flatMap((slot) => {
    const count = occupancy.get(slot.id ?? "");
    return count ? [{ ...slot, booked_count: count.booked, blocked_by_other_service: count.blocked_by_other_service }] : [];
  });
  const galleryImages = (galleryRows ?? []) as BusinessGalleryImage[];
  const faqs = (faqRows ?? []) as BusinessFaq[];
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
          {pago ? (
            <div className="mb-6 border border-line bg-white p-4 text-sm font-semibold text-ink-soft">
              {pago === "aprobado"
                ? "Pago aprobado. Tu turno quedó confirmado."
                : pago === "fallido"
                  ? "El pago no se completó. Podés intentar reservar nuevamente."
                  : "El pago quedó pendiente de confirmación."}
            </div>
          ) : null}

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

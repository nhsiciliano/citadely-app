import { cache, type CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PublicBookingForm } from "@/components/public-booking-form";
import { PublicBusinessInfo, WhatsAppIcon } from "@/components/public-business-info";
import { PublicGalleryCarousel } from "@/components/public-gallery-carousel";
import { LogoMark } from "@/components/ui";
import {
  PUBLIC_BUSINESS_COLUMNS,
  type Appointment,
  type BusinessFaq,
  type BusinessGalleryImage,
  type PublicBusiness,
  type Service,
  type ServiceAvailabilitySlot,
} from "@/lib/citadely-db";
import { insforge } from "@/lib/insforge";
import { formatWhatsAppPhone, getPublicAvailabilitySummary, getWhatsAppUrl } from "@/lib/public-profile";
import { INDEX_ROBOTS, absoluteUrl, serializeJsonLd } from "@/lib/seo";

type PublicPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pago?: string }>;
};

const getPublicBusiness = cache(async (slug: string) => {
  const { data } = await insforge.database
    .from("businesses")
    .select(PUBLIC_BUSINESS_COLUMNS)
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  return (data as PublicBusiness | null) ?? null;
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

  const title = `${business.name} | Turnos online`;
  const description = getBusinessDescription(business);
  const canonicalPath = `/b/${encodeURIComponent(business.slug)}`;
  const images = business.cover_image_url
    ? [{ url: business.cover_image_url, alt: `Portada de ${business.name}` }]
    : business.logo_url
      ? [{ url: business.logo_url, alt: `Logo de ${business.name}` }]
      : [{ url: "/opengraph-image", alt: "Citadely — Agenda y turnos online para negocios" }];

  return {
    title,
    description,
    robots: INDEX_ROBOTS,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: "website",
      locale: "es_AR",
      title,
      description,
      url: canonicalPath,
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

  const [{ data: serviceRows }, { data: appointmentRows }, { data: availabilityRows }, { data: galleryRows }, { data: faqRows }] = await Promise.all([
    insforge.database.from("services").select("*").eq("business_id", business.id).eq("is_active", true).order("created_at", { ascending: false }),
    insforge.database
      .from("appointments")
      .select("id,business_id,client_id,service_id,employee_id,starts_at,ends_at,status,source,client_message")
      .eq("business_id", business.id)
      .gte("starts_at", new Date().toISOString())
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true }),
    insforge.database
      .from("service_availability_slots")
      .select("*")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true }),
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
  const appointments = (appointmentRows ?? []) as Appointment[];
  const availabilitySlots = (availabilityRows ?? []) as ServiceAvailabilitySlot[];
  const galleryImages = (galleryRows ?? []) as BusinessGalleryImage[];
  const faqs = (faqRows ?? []) as BusinessFaq[];
  const brandColor = business.brand_color || "#0957d9";
  const availability = getPublicAvailabilitySummary(availabilitySlots, appointments);
  const whatsappUrl = getWhatsAppUrl(business.whatsapp_phone, `Hola ${business.name}, quisiera hacer una consulta.`);
  const canonicalUrl = absoluteUrl(`/b/${encodeURIComponent(business.slug)}`);
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
    <main className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)]" style={{ "--booking-brand": brandColor } as CSSProperties}>
      <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(businessStructuredData) }} type="application/ld+json" />
      {faqStructuredData ? <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(faqStructuredData) }} type="application/ld+json" /> : null}
      <a className="skip-link" href="#reservar">Ir a reservar</a>
      <header className="bg-[var(--color-navy)] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-white/20 bg-white">
              {business.logo_url ? (
                <span aria-label={`Logo de ${business.name}`} className="block h-full w-full bg-contain bg-center bg-no-repeat" role="img" style={{ backgroundImage: `url(${business.logo_url})` }} />
              ) : (
                <span className="font-display text-lg font-semibold" style={{ color: brandColor }}>{business.name.slice(0, 1).toUpperCase()}</span>
              )}
            </div>
            <p className="truncate font-semibold">{business.name}</p>
          </div>
          <div className="flex flex-1 items-center justify-end gap-2">
            <a className="inline-flex min-h-11 items-center justify-center rounded-md px-5 text-sm font-bold text-white" href="#reservar" style={{ backgroundColor: brandColor }}>Reservar turno</a>
            {whatsappUrl ? <a aria-label={`Contactar a ${business.name} por WhatsApp`} className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-[#148b45] text-white hover:bg-[#0e7438]" href={whatsappUrl} rel="noreferrer" target="_blank"><WhatsAppIcon /></a> : null}
          </div>
        </div>
      </header>

      <section
        className="relative isolate min-h-[500px] overflow-hidden bg-cover bg-center sm:min-h-[570px]"
        style={{ backgroundColor: brandColor, backgroundImage: business.cover_image_url ? `url(${business.cover_image_url})` : undefined }}
      >
        {business.cover_image_url ? <div className="absolute inset-0 -z-10 bg-[rgba(4,15,31,.68)]" /> : null}
        {!business.cover_image_url ? <span aria-hidden="true" className="absolute right-[8%] top-1/2 -z-10 -translate-y-1/2 font-display text-[clamp(13rem,30vw,30rem)] font-semibold leading-none text-white/10">{business.name.slice(0, 1).toUpperCase()}</span> : null}
        <div className="mx-auto flex min-h-[500px] max-w-7xl items-center px-5 py-16 sm:min-h-[570px] sm:px-8 lg:px-10">
          <div className="max-w-3xl text-white">
            <h1 className="font-display text-5xl font-semibold leading-[.92] tracking-[-0.04em] sm:text-7xl lg:text-8xl">{business.name}</h1>
            {business.description ? <p className="mt-7 max-w-[62ch] text-base leading-7 text-white/80 sm:text-lg">{business.description}</p> : null}
            <a className="mt-9 inline-flex min-h-12 items-center justify-center gap-3 rounded-md bg-white px-6 text-sm font-bold text-[var(--color-navy)] hover:bg-[var(--color-surface-subtle)]" href="#reservar">Ver servicios<ArrowRight aria-hidden="true" size={17} /></a>
          </div>
        </div>
      </section>

      <PublicBusinessInfo address={business.public_address} businessName={business.name} dateCount={availability.dateCount} schedule={availability.schedule} serviceMode={business.service_mode} virtualPlatforms={business.virtual_platforms} whatsappPhone={business.whatsapp_phone} />

      {galleryImages.length > 0 ? <PublicGalleryCarousel businessName={business.name} images={galleryImages} /> : null}

      {faqs.length > 0 ? (
        <section aria-labelledby="faq-titulo" className="border-b border-[var(--color-line)] bg-[var(--color-surface-subtle)] py-10 sm:py-14">
          <div className="mx-auto grid max-w-7xl gap-7 px-5 sm:px-8 lg:grid-cols-[.55fr_1.45fr] lg:px-10">
            <div><h2 className="font-display text-3xl font-semibold tracking-[-0.035em] sm:text-4xl" id="faq-titulo">Preguntas frecuentes</h2><p className="mt-3 max-w-sm text-sm leading-6 text-[var(--color-ink-soft)]">Respuestas útiles antes de reservar.</p></div>
            <div className="border-t border-[var(--color-line-strong)]">
              {faqs.map((faq) => (
                <details className="group border-b border-[var(--color-line-strong)] bg-white open:bg-[var(--color-surface)]" key={faq.id}>
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-semibold marker:hidden"><span>{faq.question}</span><span aria-hidden="true" className="text-xl font-normal text-[var(--booking-brand)] group-open:rotate-45">+</span></summary>
                  <p className="max-w-[75ch] px-5 pb-5 text-sm leading-6 text-[var(--color-ink-soft)]">{faq.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-14">
          {pago ? (
            <div className="mb-6 border border-[var(--color-line)] bg-white p-4 text-sm font-semibold text-[var(--color-ink-soft)]">
              {pago === "aprobado"
                ? "Pago aprobado. Tu turno quedó confirmado."
                : pago === "fallido"
                  ? "El pago no se completó. Podés intentar reservar nuevamente."
                  : "El pago quedó pendiente de confirmación."}
            </div>
          ) : null}

        <div id="reservar">
        <PublicBookingForm appointments={appointments} availabilitySlots={availabilitySlots} business={business} services={services} />
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] py-6 text-sm text-[var(--color-ink-soft)]">
          <p>{business.name}</p>
          <Link className="origin-right scale-90 font-semibold hover:text-[var(--color-primary)]" href="/" aria-label="Gestionado con Citadely"><LogoMark linked={false} /></Link>
        </footer>
      </div>
    </main>
  );
}

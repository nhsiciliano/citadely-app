import "server-only";

import { unstable_cache } from "next/cache";
import {
  PUBLIC_BUSINESS_COLUMNS,
  type BusinessFaq,
  type BusinessGalleryImage,
  type PublicBusiness,
  type Service,
  type ServiceAvailabilitySlot,
} from "@/lib/citadely-db";
import { getPublicBookingWindow, PUBLIC_SLOT_LIMIT } from "@/lib/booking-window";
import { insforgePublic as insforge } from "@/lib/insforge-public";

// The public page is cached per business. It is refreshed when: the owner saves something that
// affects it (/api/revalidate-public-page), a public booking is created, or this many seconds pass
// (which also frees seats released by expired deposits).
export const PUBLIC_PAGE_REVALIDATE_SECONDS = 60;

// E2E tests write straight to the database, bypassing the routes that revalidate, so the test server
// sets PUBLIC_PAGE_REVALIDATE_SECONDS=0 to turn the data cache off. (The page-level `revalidate`
// in app/b/[slug]/page.tsx must stay a literal and only applies to production builds.)
function getRevalidateSeconds() {
  const configured = Number(process.env.PUBLIC_PAGE_REVALIDATE_SECONDS);
  return Number.isFinite(configured) && process.env.PUBLIC_PAGE_REVALIDATE_SECONDS !== undefined && process.env.PUBLIC_PAGE_REVALIDATE_SECONDS !== ""
    ? configured
    : PUBLIC_PAGE_REVALIDATE_SECONDS;
}

export const publicPageTag = (slug: string) => `public-page:${slug}`;

export type PublicSlot = ServiceAvailabilitySlot & { booked_count: number; blocked_by_other_service: boolean };

export type PublicPageData = {
  business: PublicBusiness;
  bookable: boolean;
  services: Service[];
  availabilitySlots: PublicSlot[];
  galleryImages: BusinessGalleryImage[];
  faqs: BusinessFaq[];
};

async function loadPublicBusiness(slug: string): Promise<PublicBusiness | null> {
  const { data, error } = await insforge.database
    .from("businesses")
    .select(PUBLIC_BUSINESS_COLUMNS)
    .eq("slug", slug)
    .eq("is_public", true)
    .maybeSingle();

  if (!error) return (data as PublicBusiness | null) ?? null;

  console.error("Public business lookup failed", { code: error.code, message: error.message });
  // Backend branches that predate public_theme.
  const legacyColumns = PUBLIC_BUSINESS_COLUMNS.split(",").filter((column) => column !== "public_theme").join(",");
  const legacy = await insforge.database.from("businesses").select(legacyColumns).eq("slug", slug).eq("is_public", true).maybeSingle();
  // Errors are thrown, never cached: a transient failure must not freeze the page.
  if (legacy.error) throw new Error(`Public business fallback failed: ${legacy.error.message}`);
  const legacyBusiness = legacy.data as Omit<PublicBusiness, "public_theme"> | null;
  return legacyBusiness ? { ...legacyBusiness, public_theme: {} } : null;
}

async function loadPublicPageData(slug: string): Promise<PublicPageData | null> {
  const business = await loadPublicBusiness(slug);
  if (!business) return null;

  const bookingWindow = getPublicBookingWindow();
  const [services, slots, gallery, faqs] = await Promise.all([
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

  const failed = services.error ?? slots.error ?? gallery.error ?? faqs.error;
  if (failed) throw new Error(`Public page data failed: ${failed.message}`);

  const rawSlots = (slots.data ?? []) as ServiceAvailabilitySlot[];
  let availabilitySlots: PublicSlot[] = [];
  if (rawSlots.length) {
    const occupancy = await insforge.database.rpc("get_public_slot_occupancy", {
      p_business_id: business.id,
      p_slot_ids: rawSlots.map((slot) => slot.id),
    });
    if (occupancy.error) throw new Error(`Slot occupancy failed: ${occupancy.error.message}`);
    const bySlot = new Map(((occupancy.data ?? []) as { slot_id: string; booked: number; blocked_by_other_service: boolean }[]).map((row) => [row.slot_id, row]));
    availabilitySlots = rawSlots.flatMap((slot) => {
      const count = bySlot.get(slot.id ?? "");
      return count ? [{ ...slot, booked_count: count.booked, blocked_by_other_service: count.blocked_by_other_service }] : [];
    });
  }

  return {
    business,
    // Citadely es gratuito: toda página publicada (loadPublicBusiness ya filtra is_public) acepta reservas.
    bookable: true,
    services: (services.data ?? []) as Service[],
    availabilitySlots,
    galleryImages: (gallery.data ?? []) as BusinessGalleryImage[],
    faqs: (faqs.data ?? []) as BusinessFaq[],
  };
}

/** Cached public page data (null when the business does not exist or is not public). */
export function getPublicPageData(slug: string) {
  const seconds = getRevalidateSeconds();
  if (seconds <= 0) return loadPublicPageData(slug);
  return unstable_cache(() => loadPublicPageData(slug), ["public-page-data", slug], {
    tags: [publicPageTag(slug)],
    revalidate: seconds,
  })();
}

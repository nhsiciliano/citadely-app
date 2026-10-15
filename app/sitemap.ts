import type { MetadataRoute } from "next";
import { mapWithConcurrency } from "@/lib/concurrency";
import { insforge } from "@/lib/insforge";
import { SITE_ORIGIN } from "@/lib/seo";
import { getBusinessPublicUrl } from "@/lib/urls";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data }, { data: blogPosts }] = await Promise.all([insforge.database
    .from("businesses")
    .select("id,slug")
    .eq("is_public", true)
    .order("slug", { ascending: true })
    .limit(50_000), insforge.database.from("blog_posts")
      .select("slug,updated_at").eq("status", "published")
      .order("published_at", { ascending: false }).limit(50_000)]);

  // Solo negocios con reservas habilitadas: la página de los demás responde noindex.
  const bookableBusinesses = (await mapWithConcurrency(
    (data ?? []) as Array<{ id: string; slug: string }>,
    5,
    async (business) => {
      const { data: bookable, error } = await insforge.database.rpc("business_has_booking_access", {
        target_business_id: business.id,
      });
      return !error && bookable === true ? business : null;
    },
  )).filter((business): business is { id: string; slug: string } => business !== null);

  return [
    {
      url: SITE_ORIGIN,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${SITE_ORIGIN}/politica-de-privacidad`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_ORIGIN}/condiciones-del-servicio`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_ORIGIN}/blog`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...((blogPosts ?? []) as Array<{ slug: string; updated_at: string }>).map(({ slug, updated_at }) => ({
      url: `${SITE_ORIGIN}/blog/${encodeURIComponent(slug)}`,
      lastModified: new Date(updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...bookableBusinesses.map(({ slug }) => ({
      url: getBusinessPublicUrl(slug),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

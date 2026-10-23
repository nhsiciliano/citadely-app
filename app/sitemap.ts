import type { MetadataRoute } from "next";
import { insforgePublic as insforge } from "@/lib/insforge-public";
import { SITE_ORIGIN } from "@/lib/seo";
import { getBusinessPublicUrl } from "@/lib/urls";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data }, { data: blogPosts }] = await Promise.all([insforge.database
    .from("businesses")
    .select("slug,updated_at")
    .eq("is_public", true)
    .order("slug", { ascending: true })
    .limit(50_000), insforge.database.from("blog_posts")
      .select("slug,updated_at").eq("status", "published")
      .order("published_at", { ascending: false }).limit(50_000)]);

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
    // Toda página publicada acepta reservas (Citadely es gratuito).
    ...((data ?? []) as Array<{ slug: string; updated_at: string }>).map(({ slug, updated_at }) => ({
      url: getBusinessPublicUrl(slug),
      lastModified: new Date(updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

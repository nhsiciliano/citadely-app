import type { MetadataRoute } from "next";
import { insforge } from "@/lib/insforge";
import { SITE_ORIGIN } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data }, { data: blogPosts }] = await Promise.all([insforge.database
    .from("businesses")
    .select("slug")
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
    ...((data ?? []) as Array<{ slug: string }>).map(({ slug }) => ({
      url: `${SITE_ORIGIN}/b/${encodeURIComponent(slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

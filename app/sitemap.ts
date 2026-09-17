import type { MetadataRoute } from "next";
import { insforge } from "@/lib/insforge";
import { SITE_ORIGIN } from "@/lib/seo";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { data } = await insforge.database
    .from("businesses")
    .select("slug")
    .eq("is_public", true)
    .order("slug", { ascending: true })
    .limit(50_000);

  return [
    {
      url: SITE_ORIGIN,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...((data ?? []) as Array<{ slug: string }>).map(({ slug }) => ({
      url: `${SITE_ORIGIN}/b/${encodeURIComponent(slug)}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

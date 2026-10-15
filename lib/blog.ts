import "server-only";
import { insforge } from "@/lib/insforge";
import { insforgeAdmin } from "@/lib/insforge-admin";

export type BlogBlockKind = "heading2" | "heading3" | "paragraph" | "ordered_list" | "unordered_list" | "quote";
export type BlogBlock = { id?: string; position: number; kind: BlogBlockKind; content: string };
export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  cover_url: string | null;
  cover_key: string | null;
  cover_alt: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export const BLOG_PAGE_SIZE = 8;

// Publicaciones por página en el panel editorial.
export const ADMIN_POSTS_PAGE_SIZE = 25;
export const BLOG_POST_COLUMNS = "id,title,slug,cover_url,cover_key,cover_alt,status,published_at,created_at,updated_at";

export function blogSlug(title: string) {
  return title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 90).replace(/-$/g, "") || "publicacion";
}

export function blogDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(value));
}

export async function getPublishedPosts(page: number) {
  const from = (page - 1) * BLOG_PAGE_SIZE;
  const { data, count, error } = await insforge.database.from("blog_posts")
    .select(BLOG_POST_COLUMNS, { count: "exact" }).eq("status", "published")
    .order("published_at", { ascending: false }).order("id", { ascending: false })
    .range(from, from + BLOG_PAGE_SIZE - 1);
  if (error) throw error;
  return { posts: (data ?? []) as BlogPost[], count: count ?? 0 };
}

export async function getPublishedPost(slug: string) {
  const { data, error } = await insforge.database.from("blog_posts").select(BLOG_POST_COLUMNS)
    .eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) throw error;
  return data as BlogPost | null;
}

export async function getBlogBlocks(postId: string, admin = false) {
  const client = admin ? insforgeAdmin : insforge;
  if (!client) throw new Error("InsForge admin no configurado.");
  const { data, error } = await client.database.from("blog_post_blocks")
    .select("id,post_id,position,kind,content").eq("post_id", postId)
    .order("position", { ascending: true }).limit(100);
  if (error) throw error;
  return (data ?? []) as BlogBlock[];
}

export async function getAdminPost(id: string) {
  if (!insforgeAdmin) throw new Error("InsForge admin no configurado.");
  const { data, error } = await insforgeAdmin.database.from("blog_posts")
    .select(BLOG_POST_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as BlogPost | null;
}

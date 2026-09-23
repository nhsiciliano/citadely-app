import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAdminPost, getBlogBlocks, type BlogBlockKind } from "@/lib/blog";
import { hasAdminRequest, hasSameOrigin } from "@/lib/blog-admin-auth";
import { insforgeAdmin } from "@/lib/insforge-admin";

export const dynamic = "force-dynamic";
const VALID_KINDS = new Set<BlogBlockKind>(["heading2", "heading3", "paragraph", "ordered_list", "unordered_list", "quote"]);
type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  if (!hasAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  try {
    const post = await getAdminPost((await params).id);
    if (!post) return NextResponse.json({ error: "Publicación no encontrada." }, { status: 404 });
    const blocks = await getBlogBlocks(post.id, true);
    return NextResponse.json({ post, blocks }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "No se pudo cargar la publicación." }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: Params) {
  if (!hasAdminRequest(request) || !hasSameOrigin(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return NextResponse.json({ error: "Backend no configurado." }, { status: 503 });
  const id = (await params).id;
  let input: { title: string; coverAlt: string; blocks: Array<{ kind: BlogBlockKind; content: string }>; publish: boolean };
  try {
    const value = await request.json() as Record<string, unknown>;
    if (typeof value.title !== "string" || value.title.length > 180
      || typeof value.coverAlt !== "string" || value.coverAlt.length > 240
      || typeof value.publish !== "boolean" || !Array.isArray(value.blocks) || value.blocks.length > 100
      || !value.blocks.every((block) => block && typeof block === "object"
        && VALID_KINDS.has(block.kind) && typeof block.content === "string"
        && block.content.trim().length > 0 && block.content.length <= 10000)) throw new Error("invalid");
    input = value as typeof input;
  } catch {
    return NextResponse.json({ error: "Completá los campos y revisá los bloques." }, { status: 400 });
  }
  const post = await getAdminPost(id);
  if (!post) return NextResponse.json({ error: "Publicación no encontrada." }, { status: 404 });
  if (input.publish && (!input.title.trim() || !post.cover_url || !post.cover_key || !input.coverAlt.trim() || input.blocks.length === 0)) {
    return NextResponse.json({ error: "Para publicar, completá título, portada, texto alternativo y contenido." }, { status: 400 });
  }
  const { error } = await insforgeAdmin.database.rpc("admin_save_blog_post", {
    p_id: id,
    p_title: input.title,
    p_cover_alt: input.coverAlt,
    p_blocks: input.blocks,
    p_publish: input.publish,
  });
  if (error) return NextResponse.json({ error: "No se pudo guardar la publicación." }, { status: 500 });
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: Params) {
  if (!hasAdminRequest(request) || !hasSameOrigin(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return NextResponse.json({ error: "Backend no configurado." }, { status: 503 });
  const post = await getAdminPost((await params).id);
  if (!post) return NextResponse.json({ error: "Publicación no encontrada." }, { status: 404 });
  const { error } = await insforgeAdmin.database.from("blog_posts").delete().eq("id", post.id);
  if (error) return NextResponse.json({ error: "No se pudo eliminar la publicación." }, { status: 500 });
  if (post.cover_key) {
    const { error: imageError } = await insforgeAdmin.storage.from("blog-assets").remove(post.cover_key);
    if (imageError) console.error("Blog cover cleanup failed", post.id, imageError);
  }
  revalidatePath("/blog");
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ ok: true });
}

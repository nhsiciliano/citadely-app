import { NextResponse } from "next/server";
import { hasAdminRequest, hasSameOrigin } from "@/lib/blog-admin-auth";
import { BLOG_POST_COLUMNS, blogSlug, type BlogPost } from "@/lib/blog";
import { insforgeAdmin } from "@/lib/insforge-admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!hasAdminRequest(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return NextResponse.json({ error: "Backend no configurado." }, { status: 503 });
  const { data, error } = await insforgeAdmin.database.from("blog_posts")
    .select(BLOG_POST_COLUMNS).order("updated_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: "No se pudieron cargar las publicaciones." }, { status: 500 });
  return NextResponse.json({ posts: (data ?? []) as BlogPost[] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!hasAdminRequest(request) || !hasSameOrigin(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return NextResponse.json({ error: "Backend no configurado." }, { status: 503 });
  let title = "";
  try {
    const input = await request.json() as { title?: unknown };
    if (typeof input.title !== "string") throw new Error("Título inválido.");
    title = input.title.trim();
    if (!title || title.length > 180) throw new Error("Título inválido.");
  } catch {
    return NextResponse.json({ error: "Ingresá un título de hasta 180 caracteres." }, { status: 400 });
  }

  const base = blogSlug(title);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await insforgeAdmin.database.from("blog_posts")
      .insert([{ title, slug }]).select(BLOG_POST_COLUMNS).single();
    if (!error && data) return NextResponse.json({ post: data as BlogPost }, { status: 201 });
    if (String((error as { code?: string } | null)?.code) !== "23505"
      && !String(error?.message ?? "").includes("unique")) break;
  }
  return NextResponse.json({ error: "No se pudo crear el borrador." }, { status: 500 });
}

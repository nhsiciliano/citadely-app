import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { getAdminPost } from "@/lib/blog";
import { hasAdminRequest, hasSameOrigin } from "@/lib/blog-admin-auth";
import { insforgeAdmin } from "@/lib/insforge-admin";

export const dynamic = "force-dynamic";
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const ACCEPTED_FORMAT = new Set(["jpeg", "png", "webp"]);

export async function POST(request: Request) {
  if (!hasAdminRequest(request) || !hasSameOrigin(request)) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  if (!insforgeAdmin) return NextResponse.json({ error: "Backend no configurado." }, { status: 503 });

  try {
    const form = await request.formData();
    const postId = form.get("postId");
    const file = form.get("image");
    if (typeof postId !== "string" || !(file instanceof File) || !ACCEPTED_MIME.has(file.type)
      || file.size < 1 || file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json({ error: "Subí un JPG, PNG o WebP de hasta 4 MB." }, { status: 400 });
    }
    const post = await getAdminPost(postId);
    if (!post) return NextResponse.json({ error: "Publicación no encontrada." }, { status: 404 });
    const bytes = Buffer.from(await file.arrayBuffer());
    const metadata = await sharp(bytes, { limitInputPixels: 50_000_000 }).metadata();
    if (!metadata.format || !ACCEPTED_FORMAT.has(metadata.format)) {
      return NextResponse.json({ error: "El archivo no es una imagen admitida." }, { status: 400 });
    }
    const converted = await sharp(bytes, { limitInputPixels: 50_000_000 })
      .rotate().resize({ width: 1600, height: 900, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 }).toBuffer();
    const key = `posts/${post.id}/${randomUUID()}.webp`;
    const uploadFile = new File([new Uint8Array(converted)], "portada.webp", { type: "image/webp" });
    const { data: uploaded, error: uploadError } = await insforgeAdmin.storage.from("blog-assets").upload(key, uploadFile);
    if (uploadError || !uploaded?.url) throw uploadError ?? new Error("Upload without URL");
    const { error: updateError } = await insforgeAdmin.database.from("blog_posts")
      .update({ cover_url: uploaded.url, cover_key: uploaded.key ?? key }).eq("id", post.id);
    if (updateError) {
      await insforgeAdmin.storage.from("blog-assets").remove(uploaded.key ?? key);
      throw updateError;
    }
    if (post.cover_key) {
      const { error: removeError } = await insforgeAdmin.storage.from("blog-assets").remove(post.cover_key);
      if (removeError) console.error("Blog old cover cleanup failed", post.id, removeError);
    }
    revalidatePath("/blog");
    revalidatePath(`/blog/${post.slug}`);
    return NextResponse.json({ url: uploaded.url, key: uploaded.key ?? key });
  } catch (error) {
    console.error("Blog image upload failed", error);
    return NextResponse.json({ error: "No se pudo subir la portada." }, { status: 500 });
  }
}

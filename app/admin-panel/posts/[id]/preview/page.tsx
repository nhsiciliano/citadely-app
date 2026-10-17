import Image from "next/image";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { BlogContent } from "@/components/blog-content";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { blogDate, getAdminPost, getBlogBlocks } from "@/lib/blog";
import { hasAdminSession } from "@/lib/blog-admin-auth";

type Params = { params: Promise<{ id: string }> };

export default async function AdminPreviewPage({ params }: Params) {
  if (!(await hasAdminSession())) redirect("/admin-panel");
  const post = await getAdminPost((await params).id);
  if (!post) notFound();
  const blocks = await getBlogBlocks(post.id, true);
  return <main className="min-h-screen bg-white">
    <MarketingHeader />
    <div className="sticky top-18 z-40 bg-warning-soft px-5 py-3 text-center text-sm font-semibold text-warning">Vista previa privada · {post.status === "draft" ? "Borrador" : "Publicado"}</div>
    <article>
      <header className="mx-auto max-w-5xl px-5 pb-10 pt-12 sm:px-8">
        <Link className="text-sm font-semibold text-primary" href={`/admin-panel/posts/${post.id}`}>← Volver al editor</Link>
        <h1 className="font-display mt-8 text-balance text-4xl font-semibold leading-tight text-navy sm:text-6xl">{post.title || "Sin título"}</h1>
        <p className="mt-5 text-sm text-ink-soft">{post.published_at ? blogDate(post.published_at) : "Sin publicar"} · Equipo Citadely</p>
      </header>
      {post.cover_url ? <div className="relative mx-auto aspect-[16/9] max-w-5xl bg-primary-soft"><Image alt={post.cover_alt || "Portada de la publicación"} className="object-cover" fill sizes="(max-width: 1024px) 100vw, 1024px" src={post.cover_url} /></div> : null}
      <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8"><BlogContent blocks={blocks} /></div>
    </article>
    <MarketingFooter />
  </main>;
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BlogContent } from "@/components/blog-content";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { blogDate, getBlogBlocks, getPublishedPost } from "@/lib/blog";
import { INDEX_ROBOTS, SITE_ORIGIN, serializeJsonLd } from "@/lib/seo";

// Cached until the editor saves: the admin API calls revalidatePath for the post and the listing.
export const revalidate = 3600;
type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const post = await getPublishedPost((await params).slug);
  if (!post) return { title: "Publicación no encontrada", robots: { index: false, follow: false } };
  return {
    title: post.title,
    description: `${post.title}. Novedades y actualizaciones de Citadely.`,
    alternates: { canonical: `/blog/${post.slug}` },
    robots: INDEX_ROBOTS,
    openGraph: { type: "article", title: post.title, url: `/blog/${post.slug}`, publishedTime: post.published_at ?? undefined,
      images: post.cover_url ? [{ url: post.cover_url, alt: post.cover_alt }] : undefined },
    twitter: { card: "summary_large_image", title: post.title, images: post.cover_url ? [post.cover_url] : undefined },
  };
}

export default async function BlogPostPage({ params }: Params) {
  const post = await getPublishedPost((await params).slug);
  if (!post) notFound();
  const blocks = await getBlogBlocks(post.id);
  const data = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    image: post.cover_url,
    datePublished: post.published_at,
    dateModified: post.updated_at,
    mainEntityOfPage: `${SITE_ORIGIN}/blog/${post.slug}`,
    author: { "@type": "Organization", name: "Equipo Citadely" },
    publisher: { "@type": "Organization", name: "Citadely", url: SITE_ORIGIN },
    inLanguage: "es-AR",
  };

  return (
    <main className="min-h-screen bg-white">
      <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} type="application/ld+json" />
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <MarketingHeader />
      <article id="contenido">
        <header className="mx-auto max-w-5xl px-5 pb-10 pt-12 sm:px-8 sm:pt-16">
          <Link className="inline-flex items-center gap-2 text-sm font-semibold text-primary" href="/blog"><ArrowLeft aria-hidden="true" size={16} />Volver al blog</Link>
          <h1 className="font-display mt-9 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.035em] text-navy sm:text-6xl">{post.title}</h1>
          <p className="mt-6 text-sm text-ink-soft"><time dateTime={post.published_at!}>{blogDate(post.published_at!)}</time> · Equipo Citadely</p>
        </header>
        {post.cover_url ? <div className="relative mx-auto aspect-[16/9] max-w-5xl bg-primary-soft"><Image alt={post.cover_alt} className="object-cover" fill preload sizes="(max-width: 1024px) 100vw, 1024px" src={post.cover_url} /></div> : null}
        <div className="mx-auto max-w-3xl px-5 py-14 sm:px-8 sm:py-20"><BlogContent blocks={blocks} /></div>
      </article>
      <div className="mx-auto max-w-3xl border-t border-line px-5 py-10 sm:px-8"><Link className="inline-flex items-center gap-2 font-semibold text-primary" href="/blog"><ArrowLeft aria-hidden="true" size={18} />Más novedades</Link></div>
      <MarketingFooter />
    </main>
  );
}

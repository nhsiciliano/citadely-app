import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowLeft } from "lucide-react";
import { MarketingFooter, MarketingHeader } from "@/components/marketing-shell";
import { BLOG_PAGE_SIZE, blogDate, getPublishedPosts } from "@/lib/blog";
import { INDEX_ROBOTS, SITE_ORIGIN, serializeJsonLd } from "@/lib/seo";

export const dynamic = "force-dynamic";
type SearchParams = { searchParams: Promise<{ page?: string }> };

function parsePage(value: string | undefined) {
  const number = Number(value ?? "1");
  return Number.isSafeInteger(number) && number > 0 && number <= 1000 ? number : 1;
}

export async function generateMetadata({ searchParams }: SearchParams): Promise<Metadata> {
  const page = parsePage((await searchParams).page);
  const suffix = page > 1 ? ` · Página ${page}` : "";
  const canonical = page > 1 ? `/blog?page=${page}` : "/blog";
  return {
    title: `Blog${suffix}`,
    description: "Novedades, mejoras y actualizaciones de Citadely, la central de turnos para negocios de servicios.",
    alternates: { canonical },
    robots: INDEX_ROBOTS,
    openGraph: { title: `Blog de Citadely${suffix}`, url: canonical, type: "website" },
  };
}

export default async function BlogPage({ searchParams }: SearchParams) {
  const page = parsePage((await searchParams).page);
  const { posts, count } = await getPublishedPosts(page);
  const featured = page === 1 ? posts[0] : null;
  const entries = featured ? posts.slice(1) : posts;
  const totalPages = Math.ceil(count / BLOG_PAGE_SIZE);
  const showList = count === 0 || page > 1 || entries.length > 0;
  const data = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog de Citadely",
    url: `${SITE_ORIGIN}/blog`,
    inLanguage: "es-AR",
    publisher: { "@type": "Organization", name: "Citadely", url: SITE_ORIGIN },
  };

  return (
    <main className="min-h-screen bg-white">
      <script dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} type="application/ld+json" />
      <a className="skip-link" href="#contenido">Saltar al contenido</a>
      <MarketingHeader />
      <div id="contenido">
        <div className="border-b border-[var(--color-line)] bg-[var(--color-surface-subtle)]">
          <div className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
            <p className="text-sm font-semibold text-[var(--color-primary)]">Novedades de Citadely</p>
            <h1 className="font-display mt-4 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.035em] text-[var(--color-navy)] sm:text-6xl">Ideas y mejoras para tu jornada.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--color-ink-soft)]">Actualizaciones de la plataforma y formas de aprovechar mejor tu central de turnos.</p>
          </div>
        </div>

        {featured ? (
          <section className="mx-auto grid max-w-[1440px] border-b border-[var(--color-line)] lg:grid-cols-[1.18fr_.82fr]">
            <Link aria-label={`Leer ${featured.title}`} className="relative block aspect-[16/10] overflow-hidden bg-[var(--color-primary-soft)] lg:aspect-auto" href={`/blog/${featured.slug}`}>
              <Image alt={featured.cover_alt} className="object-cover transition-transform duration-300 hover:scale-[1.02]" fill preload sizes="(max-width: 1024px) 100vw, 60vw" src={featured.cover_url!} />
            </Link>
            <div className="flex flex-col justify-center px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-primary)]">Publicación reciente</p>
              <h2 className="font-display mt-5 text-4xl font-semibold leading-tight tracking-[-0.035em] text-[var(--color-navy)] sm:text-5xl"><Link className="hover:text-[var(--color-primary)]" href={`/blog/${featured.slug}`}>{featured.title}</Link></h2>
              <p className="mt-5 text-sm text-[var(--color-ink-soft)]"><time dateTime={featured.published_at!}>{blogDate(featured.published_at!)}</time> · Equipo Citadely</p>
              <Link className="mt-8 inline-flex items-center gap-2 font-semibold text-[var(--color-primary)] hover:underline" href={`/blog/${featured.slug}`}>Leer publicación<ArrowRight aria-hidden="true" size={18} /></Link>
            </div>
          </section>
        ) : null}

        {showList ? <section aria-labelledby="blog-list-title" className="mx-auto max-w-[1440px] px-5 py-14 sm:px-8 sm:py-20 lg:px-12">
          <div className="flex items-end justify-between gap-5 border-b border-[var(--color-line)] pb-5">
            <h2 className="font-display text-3xl font-semibold text-[var(--color-navy)]" id="blog-list-title">{page > 1 ? `Publicaciones · página ${page}` : "Todas las publicaciones"}</h2>
            <span className="font-mono text-sm text-[var(--color-ink-muted)]">{count} {count === 1 ? "artículo" : "artículos"}</span>
          </div>
          {count === 0 ? (
            <div className="py-24 text-center"><p className="font-display text-3xl font-semibold text-[var(--color-navy)]">Pronto habrá novedades.</p><p className="mt-3 text-[var(--color-ink-soft)]">Estamos preparando las primeras publicaciones.</p></div>
          ) : entries.length === 0 && page > totalPages ? (
            <p className="py-16 text-[var(--color-ink-soft)]">No hay publicaciones en esta página.</p>
          ) : (
            <div className="divide-y divide-[var(--color-line)]">
              {entries.map((post) => (
                <article className="grid gap-6 py-8 sm:grid-cols-[220px_1fr] sm:items-center" key={post.id}>
                  <Link aria-label={`Leer ${post.title}`} className="relative block aspect-[16/10] overflow-hidden bg-[var(--color-primary-soft)]" href={`/blog/${post.slug}`}>
                    <Image alt={post.cover_alt} className="object-cover transition-transform duration-300 hover:scale-[1.03]" fill sizes="(max-width: 640px) 100vw, 220px" src={post.cover_url!} />
                  </Link>
                  <div><time className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-ink-muted)]" dateTime={post.published_at!}>{blogDate(post.published_at!)}</time><h3 className="font-display mt-3 text-2xl font-semibold leading-tight text-[var(--color-navy)]"><Link className="hover:text-[var(--color-primary)]" href={`/blog/${post.slug}`}>{post.title}</Link></h3><Link className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)]" href={`/blog/${post.slug}`}>Leer publicación<ArrowRight aria-hidden="true" size={16} /></Link></div>
                </article>
              ))}
            </div>
          )}
          {totalPages > 1 ? <nav aria-label="Páginas del blog" className="mt-10 flex items-center justify-between border-t border-[var(--color-line)] pt-6 text-sm font-semibold">
            {page > 1 ? <Link className="inline-flex items-center gap-2 text-[var(--color-primary)]" href={page === 2 ? "/blog" : `/blog?page=${page - 1}`}><ArrowLeft aria-hidden="true" size={16} />Anterior</Link> : <span />}
            <span className="text-[var(--color-ink-muted)]">{page} / {totalPages}</span>
            {page < totalPages ? <Link className="inline-flex items-center gap-2 text-[var(--color-primary)]" href={`/blog?page=${page + 1}`}>Siguiente<ArrowRight aria-hidden="true" size={16} /></Link> : <span />}
          </nav> : null}
        </section> : null}
      </div>
      <MarketingFooter />
    </main>
  );
}

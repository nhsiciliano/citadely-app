import Link from "next/link";
import { LogoMark, PrimaryLink, SecondaryLink } from "@/components/ui";

const NAV_ITEMS = [
  { href: "/#como-funciona", label: "Cómo funciona" },
  { href: "/#funciones", label: "Funciones" },
  { href: "/#rubros", label: "Rubros" },
  { href: "/#precio", label: "Precio" },
  { href: "/blog", label: "Blog" },
  { href: "/#preguntas", label: "Preguntas" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <div className="mx-auto flex h-18 max-w-[1440px] items-center justify-between gap-3 px-5 sm:px-8 lg:px-12">
        <LogoMark />
        <nav aria-label="Navegación principal" className="hidden items-center gap-7 text-sm font-medium text-ink-soft lg:flex">
          {NAV_ITEMS.map(({ href, label }) => <Link className="hover:text-primary" href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="hidden items-center gap-2 sm:flex"><SecondaryLink href="/login">Ingresar</SecondaryLink><PrimaryLink href="/registro">Crear mi cuenta</PrimaryLink></div>
        <details className="group relative ml-auto lg:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-line px-4 text-sm font-semibold text-navy marker:hidden">Menú</summary>
          <nav aria-label="Menú móvil" className="absolute right-0 top-12 z-50 w-64 border border-line bg-white p-2 shadow-raised">
            {NAV_ITEMS.map(({ href, label }) => <Link className="block rounded-md px-3 py-3 text-sm font-medium text-ink hover:bg-primary-soft" href={href} key={href}>{label}</Link>)}
            <div className="mt-2 border-t border-line pt-2 sm:hidden">
              <Link className="block rounded-md px-3 py-3 text-sm font-semibold" href="/login">Ingresar</Link>
              <Link className="block rounded-md px-3 py-3 text-sm font-semibold text-primary" href="/registro">Crear mi cuenta</Link>
            </div>
          </nav>
        </details>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-white/10 bg-navy text-white">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-8 text-sm sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
        <span className="font-semibold">Citadely</span>
        <p className="text-white/65">Central de turnos para negocios de servicios.</p>
        <nav aria-label="Enlaces del footer" className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a className="text-white/70 hover:text-white" href="mailto:contacto@citadely.com.ar">contacto@citadely.com.ar</a>
          <Link className="text-white/70 hover:text-white" href="/blog">Blog</Link>
          <Link className="text-white/70 hover:text-white" href="/login">Ingresar</Link>
          <Link className="text-white/70 hover:text-white" href="/registro">Crear cuenta</Link>
          <Link className="text-white/70 hover:text-white" href="/politica-de-privacidad">Política de privacidad</Link>
          <Link className="text-white/70 hover:text-white" href="/condiciones-del-servicio">Condiciones del servicio</Link>
          <a aria-label="Citadely en Instagram (@citadely.ar)" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white" href="https://www.instagram.com/citadely.ar/" rel="noopener noreferrer" target="_blank">
            <svg aria-hidden="true" className="h-[21px] w-[21px]" fill="none" viewBox="0 0 24 24">
              <rect height="18" rx="5" stroke="currentColor" strokeWidth="1.8" width="18" x="3" y="3" />
              <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="17.5" cy="6.5" fill="currentColor" r="1.1" />
            </svg>
          </a>
        </nav>
      </div>
    </footer>
  );
}

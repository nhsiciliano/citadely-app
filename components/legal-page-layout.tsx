import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoMark } from "@/components/ui";

export function LegalPageLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--color-canvas)]">
      <header className="border-b border-[var(--color-line)] bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
          <LogoMark />
          <Link className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary-strong)]" href="/">
            <ArrowLeft aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Volver al inicio</span>
            <span className="sm:hidden">Inicio</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-5 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-20">
        <div className="mx-auto max-w-[800px]">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--color-primary)]">Información legal</p>
          <h1 className="font-display mt-4 text-4xl font-semibold tracking-[-0.045em] text-[var(--color-navy)] sm:text-5xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-ink-soft)]">{description}</p>
          <p className="mt-5 text-sm text-[var(--color-ink-muted)]">Última actualización del borrador: 22 de septiembre de 2026</p>

          <div className="mt-8 border-l-4 border-[var(--color-primary)] bg-[var(--color-primary-soft)] px-5 py-4 text-sm leading-6 text-[var(--color-navy)]" role="note">
            <strong>Borrador para revisión legal.</strong> Antes de publicarlo deben completarse los datos legales de quien opera Citadely y aprobarse su contenido.
          </div>

          <article className="mt-10 border border-[var(--color-line)] bg-white px-5 py-3 shadow-[var(--shadow-surface)] sm:px-9 sm:py-5">
            {children}
          </article>
        </div>
      </main>

      <footer className="border-t border-white/10 bg-[var(--color-navy)] px-5 py-7 text-sm text-white/70 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-[1440px]">Citadely · Central de turnos para negocios de servicios.</div>
      </footer>
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-[var(--color-line)] py-7 last:border-b-0 sm:py-8">
      <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-[var(--color-navy)]">{title}</h2>
      <div className="mt-4 space-y-4 text-[0.9375rem] leading-7 text-[var(--color-ink-soft)] [&_a]:font-semibold [&_a]:text-[var(--color-primary)] [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

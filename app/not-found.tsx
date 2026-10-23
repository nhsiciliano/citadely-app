import type { Metadata } from "next";
import { LogoMark } from "@/components/ui";

export const metadata: Metadata = {
  title: "Página no disponible",
};

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5">
      <section className="max-w-xl border border-line bg-white p-8 text-center shadow-surface">
        <div className="mb-7 flex justify-center"><LogoMark linked={false} /></div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.04em]">Página no disponible</h1>
        <p className="mt-3 text-ink-soft">La dirección no existe o no está disponible públicamente.</p>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- / lo sirve la landing Astro vía rewrite */}
        <a className="button-primary mt-6" href="/">Volver a Citadely</a>
      </section>
    </main>
  );
}

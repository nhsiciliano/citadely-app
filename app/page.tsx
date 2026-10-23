import type { Metadata } from "next";
import { NO_INDEX_ROBOTS } from "@/lib/seo";

// Con LANDING_ORIGIN definido, next.config.ts reescribe / hacia la landing Astro y esta página no se ve.
export const metadata: Metadata = {
  robots: NO_INDEX_ROBOTS,
};

export default function LandingPlaceholder() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-5">
      <p className="max-w-xl text-center text-ink-soft">
        La landing se sirve desde apps/landing. Definí LANDING_ORIGIN o corré pnpm landing:dev.
      </p>
    </main>
  );
}

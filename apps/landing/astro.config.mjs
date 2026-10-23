// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, fontProviders } from "astro/config";

// Static site deployed as its own Vercel project and served under www.citadely.com.ar through
// Next rewrites (next.config.ts). Next only rewrites /, the legal pages and /landing-assets/*, so
// every built asset must live under landing-assets and public/ must stay empty.
export default defineConfig({
  site: "https://www.citadely.com.ar",
  output: "static",
  build: { assets: "landing-assets" },
  vite: { plugins: [tailwindcss()] },
  // Same families as next/font in app/layout.tsx, which loads the full variable weight range.
  fonts: [
    {
      name: "Geist",
      cssVariable: "--font-geist-sans",
      provider: fontProviders.google(),
      weights: ["100 900"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["Arial", "Helvetica", "sans-serif"],
    },
    {
      name: "Geist Mono",
      cssVariable: "--font-geist-mono",
      provider: fontProviders.google(),
      weights: ["100 900"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["monospace"],
    },
    {
      name: "Funnel Display",
      cssVariable: "--font-funnel-display",
      provider: fontProviders.google(),
      weights: ["300 800"],
      styles: ["normal"],
      subsets: ["latin"],
      fallbacks: ["sans-serif"],
    },
  ],
});

import { describe, expect, it } from "vitest";
import { withEnv } from "./helpers";

async function loadRewrites(landingOrigin: string | undefined) {
  const { default: nextConfig } = await withEnv({ LANDING_ORIGIN: landingOrigin }, () => import("@/next.config"));
  const rewrites = await nextConfig.rewrites!();
  if (Array.isArray(rewrites)) throw new Error("rewrites() must return { beforeFiles, afterFiles, fallback }");
  return { beforeFiles: rewrites.beforeFiles ?? [], afterFiles: rewrites.afterFiles ?? [] };
}

describe("next.config rewrites", () => {
  it("sends the landing routes to LANDING_ORIGIN before the filesystem", async () => {
    const { beforeFiles } = await loadRewrites("https://citadely-landing.example.com");

    expect(beforeFiles).toEqual([
      { source: "/", destination: "https://citadely-landing.example.com/" },
      { source: "/politica-de-privacidad", destination: "https://citadely-landing.example.com/politica-de-privacidad/" },
      { source: "/condiciones-del-servicio", destination: "https://citadely-landing.example.com/condiciones-del-servicio/" },
      { source: "/landing-assets/:path*", destination: "https://citadely-landing.example.com/landing-assets/:path*" },
    ]);
  });

  it("ignores trailing slashes in LANDING_ORIGIN", async () => {
    const { beforeFiles } = await loadRewrites("https://citadely-landing.example.com//");

    expect(beforeFiles).toHaveLength(4);
    expect(beforeFiles[0]).toEqual({ source: "/", destination: "https://citadely-landing.example.com/" });
  });

  it("adds no landing rewrites without LANDING_ORIGIN, so / falls back to app/page.tsx", async () => {
    const { beforeFiles } = await loadRewrites(undefined);

    expect(beforeFiles).toEqual([]);
  });

  it("keeps the admin-panel API rewrite with and without the landing", async () => {
    const adminRewrite = { source: "/admin-panel/api/:path*", destination: "/api/admin/:path*" };

    expect((await loadRewrites("https://citadely-landing.example.com")).afterFiles).toEqual([adminRewrite]);
    expect((await loadRewrites(undefined)).afterFiles).toEqual([adminRewrite]);
  });
});

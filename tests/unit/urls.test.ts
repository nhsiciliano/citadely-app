import { afterEach, describe, expect, it, vi } from "vitest";
import { withEnv } from "./helpers";

afterEach(() => vi.unstubAllEnvs());

describe("lib/urls", () => {
  it("usa subdominios en producción", async () => {
    const { getBusinessPublicUrl } = await withEnv({ VERCEL_ENV: "production" }, () => import("@/lib/urls"));
    expect(getBusinessPublicUrl("clinicacolon")).toBe("https://clinicacolon.citadely.com.ar/");
  });

  it("usa /b/<slug> en el mismo origen fuera de producción", async () => {
    const { getBusinessPublicUrl } = await withEnv({ VERCEL_ENV: "preview", VERCEL_URL: "citadely-git-x.vercel.app" }, () => import("@/lib/urls"));
    expect(getBusinessPublicUrl("clinicacolon")).toBe("https://citadely-git-x.vercel.app/b/clinicacolon");
    expect(getBusinessPublicUrl("clinicacolon", "http://localhost:3000/")).toBe("http://localhost:3000/b/clinicacolon");
  });

  it("cae en APP_BASE_URL y luego en el dominio base", async () => {
    const withBase = await withEnv({ VERCEL_ENV: "development", VERCEL_URL: "", APP_BASE_URL: "https://www.ejemplo.test/" }, () => import("@/lib/urls"));
    expect(withBase.getBusinessPublicUrl("a")).toBe("https://www.ejemplo.test/b/a");
    const bare = await withEnv({ VERCEL_ENV: "development", VERCEL_URL: "", APP_BASE_URL: "" }, () => import("@/lib/urls"));
    expect(bare.getBusinessPublicUrl("a")).toBe("https://citadely.com.ar/b/a");
  });

  it("extrae el subdominio solo de un nivel bajo el dominio base", async () => {
    const { getBusinessSubdomain, isMainAppHost } = await import("@/lib/urls");
    expect(getBusinessSubdomain("clinicacolon.citadely.com.ar")).toBe("clinicacolon");
    expect(getBusinessSubdomain("CLINICACOLON.citadely.com.ar:3000")).toBe("clinicacolon");
    expect(getBusinessSubdomain("www.citadely.com.ar")).toBeNull();
    expect(getBusinessSubdomain("citadely.com.ar")).toBeNull();
    expect(getBusinessSubdomain("otro.clinicacolon.citadely.com.ar")).toBeNull();
    expect(getBusinessSubdomain("ejemplo.com")).toBeNull();
    expect(isMainAppHost("www.citadely.com.ar")).toBe(true);
    expect(isMainAppHost("clinicacolon.citadely.com.ar")).toBe(false);
  });
});

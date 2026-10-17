import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { withEnv } from "./helpers";

afterEach(() => vi.unstubAllEnvs());

const request = (url: string, host = new URL(url).host) => new NextRequest(url, { headers: { host } });

describe("proxy (producción)", () => {
  const load = () => withEnv({ VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_ENV: "production" }, () => import("@/proxy"));

  it("el subdominio reescribe la portada sin redirigir al cliente", async () => {
    const { proxy } = await load();
    const response = await proxy(request("https://clinicacolon.citadely.com.ar/?pago=aprobado"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://clinicacolon.citadely.com.ar/b/clinicacolon?pago=aprobado");
  });

  it("los enlaces antiguos redirigen permanentemente desde el dominio principal", async () => {
    const { proxy } = await load();
    for (const host of ["citadely.com.ar", "www.citadely.com.ar"]) {
      const response = await proxy(request(`https://${host}/b/clinicacolon?pago=aprobado`, host));
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("https://clinicacolon.citadely.com.ar/?pago=aprobado");
    }
  });

  it("la ruta interna de un subdominio redirige a la URL canónica", async () => {
    const { proxy } = await load();
    const response = await proxy(request("https://clinicacolon.citadely.com.ar/b/clinicacolon"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://clinicacolon.citadely.com.ar/");
  });
});

describe("proxy (Preview)", () => {
  it("conserva la ruta interna de negocios", async () => {
    const { proxy } = await withEnv({ VERCEL_ENV: "preview", NEXT_PUBLIC_VERCEL_ENV: "preview" }, () => import("@/proxy"));
    const response = await proxy(request("https://preview.vercel.app/b/clinicacolon"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy (sesión del panel)", () => {
  const load = () => withEnv({ VERCEL_ENV: "preview", NEXT_PUBLIC_VERCEL_ENV: "preview" }, () => import("@/proxy"));

  it("sin sesión redirige a login antes de renderizar el panel o el onboarding", async () => {
    const { proxy } = await load();
    for (const path of ["/negocio", "/negocio/agenda", "/onboarding"]) {
      const response = await proxy(request(`https://preview.vercel.app${path}`));
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(`https://preview.vercel.app/login?next=${encodeURIComponent(path)}`);
    }
  });

  it("una cookie de acceso vencida sin refresh token se borra y redirige a login", async () => {
    const { proxy } = await load();
    const expired = `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 60 })).toString("base64url")}.firma`;
    const response = await proxy(new NextRequest("https://preview.vercel.app/negocio", {
      headers: { host: "preview.vercel.app", cookie: `insforge_access_token=${expired}` },
    }));
    expect(response.status).toBe(307);
    expect(response.cookies.get("insforge_access_token")?.value).toBe("");
  });

  it("con un access token vigente deja pasar sin tocar cookies", async () => {
    const { proxy } = await load();
    const valid = `e30.${Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.firma`;
    const response = await proxy(new NextRequest("https://preview.vercel.app/negocio/agenda", {
      headers: { host: "preview.vercel.app", cookie: `insforge_access_token=${valid}` },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.cookies.getAll()).toEqual([]);
  });

  it("las páginas públicas no pasan por la sesión", async () => {
    const { proxy } = await load();
    const response = await proxy(request("https://preview.vercel.app/login"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

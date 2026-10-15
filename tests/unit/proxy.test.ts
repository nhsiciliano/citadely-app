import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { withEnv } from "./helpers";

afterEach(() => vi.unstubAllEnvs());

const request = (url: string, host = new URL(url).host) => new NextRequest(url, { headers: { host } });

describe("proxy (producción)", () => {
  const load = () => withEnv({ VERCEL_ENV: "production", NEXT_PUBLIC_VERCEL_ENV: "production" }, () => import("@/proxy"));

  it("el subdominio reescribe la portada sin redirigir al cliente", async () => {
    const { proxy } = await load();
    const response = proxy(request("https://clinicacolon.citadely.com.ar/?pago=aprobado"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-rewrite")).toBe("https://clinicacolon.citadely.com.ar/b/clinicacolon?pago=aprobado");
  });

  it("los enlaces antiguos redirigen permanentemente desde el dominio principal", async () => {
    const { proxy } = await load();
    for (const host of ["citadely.com.ar", "www.citadely.com.ar"]) {
      const response = proxy(request(`https://${host}/b/clinicacolon?pago=aprobado`, host));
      expect(response.status).toBe(308);
      expect(response.headers.get("location")).toBe("https://clinicacolon.citadely.com.ar/?pago=aprobado");
    }
  });

  it("la ruta interna de un subdominio redirige a la URL canónica", async () => {
    const { proxy } = await load();
    const response = proxy(request("https://clinicacolon.citadely.com.ar/b/clinicacolon"));
    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://clinicacolon.citadely.com.ar/");
  });
});

describe("proxy (Preview)", () => {
  it("conserva la ruta interna de negocios", async () => {
    const { proxy } = await withEnv({ VERCEL_ENV: "preview", NEXT_PUBLIC_VERCEL_ENV: "preview" }, () => import("@/proxy"));
    const response = proxy(request("https://preview.vercel.app/b/clinicacolon"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

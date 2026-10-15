import "./production-env";
import { expect, test } from "@playwright/test";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";
import { getBusinessPublicUrl, getBusinessSubdomain } from "../../lib/urls";

test("URLs públicas usan subdominios de Citadely", () => {
  expect(getBusinessPublicUrl("clinicacolon")).toBe("https://clinicacolon.citadely.com.ar/");
  expect(getBusinessSubdomain("clinicacolon.citadely.com.ar")).toBe("clinicacolon");
  expect(getBusinessSubdomain("www.citadely.com.ar")).toBeNull();
  expect(getBusinessSubdomain("otro.clinicacolon.citadely.com.ar")).toBeNull();
});

test("subdominio reescribe la portada sin redirigir al cliente", () => {
  const request = new NextRequest("https://clinicacolon.citadely.com.ar/?pago=aprobado", {
    headers: { host: "clinicacolon.citadely.com.ar" },
  });
  const response = proxy(request);

  expect(response.status).toBe(200);
  expect(response.headers.get("x-middleware-rewrite")).toBe("https://clinicacolon.citadely.com.ar/b/clinicacolon?pago=aprobado");
});

test("enlaces antiguos redirigen permanentemente desde dominio principal", () => {
  for (const host of ["citadely.com.ar", "www.citadely.com.ar"]) {
    const request = new NextRequest(`https://${host}/b/clinicacolon?pago=aprobado`, {
      headers: { host },
    });
    const response = proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("https://clinicacolon.citadely.com.ar/?pago=aprobado");
  }
});

test("ruta interna de un subdominio redirige a la URL canónica", () => {
  const request = new NextRequest("https://clinicacolon.citadely.com.ar/b/clinicacolon", {
    headers: { host: "clinicacolon.citadely.com.ar" },
  });
  const response = proxy(request);

  expect(response.status).toBe(308);
  expect(response.headers.get("location")).toBe("https://clinicacolon.citadely.com.ar/");
});

test("Preview conserva la ruta interna de negocios", () => {
  const request = new NextRequest("https://preview.vercel.app/b/clinicacolon", {
    headers: { host: "preview.vercel.app" },
  });
  const response = proxy(request);

  expect(response.status).toBe(200);
  expect(response.headers.get("x-middleware-next")).toBe("1");
});

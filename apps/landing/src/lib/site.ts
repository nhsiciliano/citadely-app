// Mirrors lib/seo.ts in the Next app: keep both in sync.
export const SITE_NAME = "Citadely";
export const SITE_ORIGIN = "https://www.citadely.com.ar";

export const HOME_TITLE = "Citadely | Agenda y turnos online para negocios";
export const HOME_DESCRIPTION =
  "Organizá agenda, servicios, clientes, señas y reservas online con Citadely. Gratis para tu negocio, sin planes ni período de prueba.";

export const LEGAL_PATHS = {
  privacy: "/politica-de-privacidad",
  terms: "/condiciones-del-servicio",
} as const;

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

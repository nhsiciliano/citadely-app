export const SITE_NAME = "Citadely";
export const SITE_ORIGIN = "https://citadely.com.ar";
export const SITE_URL = new URL(SITE_ORIGIN);

export const HOME_TITLE = "Citadely | Agenda y turnos online para negocios";
export const HOME_DESCRIPTION =
  "Organizá agenda, servicios, clientes, señas y reservas online con Citadely. Probá gratis durante 7 días y elegí el plan para tu negocio.";

export const NO_INDEX_ROBOTS = {
  index: false,
  follow: false,
  nocache: true,
  googleBot: {
    index: false,
    follow: false,
    noimageindex: true,
  },
} as const;

export const INDEX_ROBOTS = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
} as const;

export function absoluteUrl(path = "/") {
  return new URL(path, SITE_URL).toString();
}

export function serializeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

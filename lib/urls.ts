import { isClientProduction } from "./env";

export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "citadely.com.ar";

function trimTrailingSlash(url: string) {
  return url.replace(/\/$/, "");
}

// Origen para construir URLs públicas de negocios fuera de producción. En el navegador
// usa el origen actual; en servidor, el deployment de Vercel o APP_BASE_URL como respaldo.
function resolvePublicOrigin(origin?: string) {
  if (origin) return trimTrailingSlash(origin);
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${trimTrailingSlash(process.env.VERCEL_URL)}`;
  if (process.env.APP_BASE_URL) return trimTrailingSlash(process.env.APP_BASE_URL);
  return `https://${APP_DOMAIN}`;
}

function hostName(host: string) {
  return host.split(":")[0]?.toLowerCase() ?? "";
}

export function isMainAppHost(host: string) {
  const cleanHost = hostName(host);
  const cleanDomain = hostName(APP_DOMAIN);
  return cleanHost === cleanDomain || cleanHost === `www.${cleanDomain}`;
}

// En producción cada negocio vive en su subdominio. Fuera de producción (Preview y local)
// no hay wildcard, así que la página pública es /b/<slug> en el mismo origen.
export function getBusinessPublicUrl(slug: string, origin?: string) {
  if (!isClientProduction) {
    return `${resolvePublicOrigin(origin)}/b/${slug}`;
  }
  const protocol = APP_DOMAIN.includes("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${APP_DOMAIN}/`;
}

export function getBusinessSubdomain(host: string) {
  const cleanHost = hostName(host);
  const cleanDomain = hostName(APP_DOMAIN);

  if (!cleanHost || !cleanDomain || cleanHost === cleanDomain || !cleanHost.endsWith(`.${cleanDomain}`)) {
    return null;
  }

  const subdomain = cleanHost.slice(0, -(cleanDomain.length + 1));

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subdomain) || subdomain === "www") {
    return null;
  }

  return subdomain;
}

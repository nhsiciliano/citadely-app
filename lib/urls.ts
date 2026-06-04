export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "citadely.com.ar";

export function getBusinessPublicUrl(slug: string) {
  const protocol = APP_DOMAIN.includes("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${APP_DOMAIN}`;
}

export function getBusinessSubdomain(host: string) {
  const cleanHost = host.split(":")[0]?.toLowerCase() ?? "";
  const cleanDomain = APP_DOMAIN.split(":")[0]?.toLowerCase() ?? "";

  if (!cleanHost || !cleanDomain || cleanHost === cleanDomain || !cleanHost.endsWith(`.${cleanDomain}`)) {
    return null;
  }

  const subdomain = cleanHost.slice(0, -(cleanDomain.length + 1));

  if (!subdomain || subdomain === "www" || subdomain.includes(".")) {
    return null;
  }

  return subdomain;
}

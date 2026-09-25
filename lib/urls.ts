export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "citadely.com.ar";

function hostName(host: string) {
  return host.split(":")[0]?.toLowerCase() ?? "";
}

export function isMainAppHost(host: string) {
  const cleanHost = hostName(host);
  const cleanDomain = hostName(APP_DOMAIN);
  return cleanHost === cleanDomain || cleanHost === `www.${cleanDomain}`;
}

export function getBusinessPublicUrl(slug: string) {
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

import { NextResponse, type NextRequest } from "next/server";
import { isProduction } from "@/lib/env";
import { getInsforgePublicConfig } from "@/lib/insforge-config";
import { getBusinessPublicUrl, getBusinessSubdomain, isMainAppHost } from "@/lib/urls";

// Rutas que exigen sesión. El layout de /negocio hace el control real; acá se renueva la sesión antes de
// renderizar y se redirige sin pintar nada cuando no hay ninguna.
const AUTHENTICATED_PATH = /^\/(negocio|onboarding)(\/|$)/;

async function withSession(request: NextRequest) {
  const collected = NextResponse.next();
  // RequestCookies no acepta opciones al escribir: para la request solo importan nombre y valor.
  const requestCookies = {
    get: (name: string) => request.cookies.get(name),
    set: (nameOrCookie: string | { name: string; value: string }, value?: string) => {
      if (typeof nameOrCookie === "string") request.cookies.set(nameOrCookie, value ?? "");
      else request.cookies.set(nameOrCookie.name, nameOrCookie.value);
    },
    delete: (nameOrCookie: string | { name: string }) => {
      request.cookies.delete(typeof nameOrCookie === "string" ? nameOrCookie : nameOrCookie.name);
    },
  };
  // Import diferido: las páginas públicas y los subdominios no cargan el SDK de sesión.
  const { updateSession } = await import("@insforge/sdk/ssr/middleware");
  const { accessToken } = await updateSession({
    ...getInsforgePublicConfig(),
    requestCookies,
    responseCookies: collected.cookies,
  });

  const response = accessToken
    ? NextResponse.next({ request })
    : NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
  for (const cookie of collected.cookies.getAll()) response.cookies.set(cookie);
  return response;
}

export async function proxy(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const pathname = request.nextUrl.pathname;
  const legacyBusiness = /^\/b\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/.exec(pathname);
  const subdomain = getBusinessSubdomain(host);

  // Fuera de producción no hay subdominios de negocio: /b/<slug> se sirve directo y no se redirige.
  if (isProduction && legacyBusiness && (isMainAppHost(host) || subdomain)) {
    const destination = new URL(getBusinessPublicUrl(legacyBusiness[1]));
    destination.search = request.nextUrl.search;
    return NextResponse.redirect(destination, 308);
  }

  if (!subdomain || pathname.startsWith("/b/")) {
    return AUTHENTICATED_PATH.test(pathname) ? withSession(request) : NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/b/${subdomain}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};

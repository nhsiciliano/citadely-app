import { NextResponse, type NextRequest } from "next/server";
import { isProduction } from "@/lib/env";
import { getBusinessPublicUrl, getBusinessSubdomain, isMainAppHost } from "@/lib/urls";

export function proxy(request: NextRequest) {
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
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/b/${subdomain}`;
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};

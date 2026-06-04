import { NextResponse, type NextRequest } from "next/server";
import { getBusinessSubdomain } from "@/lib/urls";

export function proxy(request: NextRequest) {
  const subdomain = getBusinessSubdomain(request.headers.get("host") ?? "");

  if (!subdomain || request.nextUrl.pathname.startsWith("/b/")) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = `/b/${subdomain}`;
  return NextResponse.rewrite(url);
}

export const proxyConfig = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};

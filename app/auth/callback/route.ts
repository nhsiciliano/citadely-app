import { NextResponse, type NextRequest } from "next/server";
import { createAuthActions, createServerClient, getAccessTokenCookieName } from "@insforge/sdk/ssr";
import { getPostAuthPath } from "@/lib/auth";
import { OAUTH_VERIFIER_COOKIE } from "@/lib/auth-cookies";
import { getInsforgePublicConfig } from "@/lib/insforge-config";

// Vuelta del login con Google: canjea insforge_code con el verifier PKCE, deja la sesión en cookies
// y redirige a /onboarding o /negocio según el perfil. Los errores vuelven a /login.
// Las cookies de sesión son del host que pidió el callback: los redirects se arman con ese host
// (request.url puede traer otro, por ejemplo localhost en lugar de 127.0.0.1 en desarrollo).
function appUrl(request: NextRequest, path: string) {
  const url = request.nextUrl.clone();
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host) url.host = host;
  const [pathname, search = ""] = path.split("?");
  url.pathname = pathname;
  url.search = search ? `?${search}` : "";
  return url;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("insforge_code");
  const verifier = request.cookies.get(OAUTH_VERIFIER_COOKIE)?.value;
  const loginUrl = (reason: string) => appUrl(request, `/login?error=${reason}`);

  if (request.nextUrl.searchParams.get("error") || !code) return NextResponse.redirect(loginUrl("oauth_failed"));
  if (!verifier) return NextResponse.redirect(loginUrl("oauth_expired"));

  const response = NextResponse.redirect(appUrl(request, "/negocio"));
  const auth = createAuthActions({
    ...getInsforgePublicConfig(),
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });
  const { data, error } = await auth.exchangeOAuthCode(code, verifier);
  if (error || !data?.user) {
    console.error("oauth code exchange failed", { message: error?.message });
    return NextResponse.redirect(loginUrl("oauth_failed"));
  }

  // El usuario del canje puede no traer el perfil completo: se lee el actual con el token recién emitido.
  const accessToken = response.cookies.get(getAccessTokenCookieName())?.value;
  const client = createServerClient({ ...getInsforgePublicConfig(), accessToken });
  const { data: current } = await client.auth.getCurrentUser();
  response.headers.set("Location", appUrl(request, getPostAuthPath(current.user ?? null)).toString());
  response.cookies.delete(OAUTH_VERIFIER_COOKIE);
  return response;
}

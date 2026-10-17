import { getRefreshTokenCookieName, refreshAuth } from "@insforge/sdk/ssr";
import { getInsforgePublicConfig } from "@/lib/insforge-config";

// El cliente de navegador renueva acá el access token con la refresh cookie httpOnly.
//
// Sin refresh cookie no hay nada que renovar ni que borrar: se responde 401 SIN Set-Cookie. El handler del SDK
// (createRefreshAuthRouter) borra las cookies de sesión aun en ese caso, y eso pisaba un login recién hecho: el
// cliente de navegador pide un refresh al cargar /login sin sesión; si esa respuesta llega después de la Server
// Action de login (pasa en dev con la ruta compilando en frío), sus Set-Cookie vencidas borraban la sesión nueva
// y el siguiente request a /negocio volvía a /login?next=%2Fnegocio.
export async function POST(request: Request) {
  const refreshCookie = `${getRefreshTokenCookieName()}=`;
  const hasRefreshCookie = request.headers.get("cookie")?.split(/;\s*/).some((part) => part.startsWith(refreshCookie) && part.length > refreshCookie.length);
  if (!hasRefreshCookie) {
    return Response.json(
      { error: "AUTH_UNAUTHORIZED", message: "Refresh token cookie is missing", statusCode: 401 },
      { status: 401 },
    );
  }

  const { response } = await refreshAuth({ ...getInsforgePublicConfig(), request });
  return response;
}

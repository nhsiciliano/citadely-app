import { createBrowserClient } from "@insforge/sdk/ssr";
import { getInsforgePublicConfig } from "@/lib/insforge-config";

// Cliente para Client Components. Lee la sesión de la cookie insforge_access_token y la renueva por
// /api/auth/refresh. Su auth es de solo lectura: ingresar, salir y editar el perfil van por app/auth/actions.ts.
// En Server Components y rutas usá lib/insforge-server.ts (con sesión) o lib/insforge-public.ts (anónimo).
export const insforge = createBrowserClient(getInsforgePublicConfig());

/** Renueva la cookie de sesión si venció, antes de llamar a una ruta API que la lee. */
export async function ensureFreshSession() {
  const { data } = await insforge.auth.getCurrentUser();
  return data.user;
}

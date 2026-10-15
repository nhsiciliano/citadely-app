import "server-only";

import { headers } from "next/headers";

/**
 * Origen de la request actual (detrás del proxy de Vercel, x-forwarded-*). Se calcula en el servidor y se
 * pasa a los Client Components para que servidor y navegador armen las mismas URLs al hidratar.
 */
export async function getRequestOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${protocol}://${host}`;
}

import { slugifyBusinessName } from "@/lib/auth";

// Keep in sync with public.is_reserved_business_slug (migration 20261015153859).
export const RESERVED_BUSINESS_SLUGS = new Set([
  "www", "app", "api", "admin", "admin-panel", "blog", "b", "negocio", "onboarding", "login", "registro",
  "cliente", "auth", "mail", "email", "smtp", "ftp", "ns1", "ns2", "status", "support", "soporte", "ayuda",
  "help", "docs", "static", "assets", "cdn", "dev", "staging", "test", "preview", "citadely", "root",
  "dashboard", "panel", "billing", "pagos", "webhook", "webhooks", "cron", "sitemap", "robots",
  "verificar-email", "recuperar-password", "politica-de-privacidad", "condiciones-del-servicio",
  "contacto", "precios",
]);

export const BUSINESS_SLUG_MIN_LENGTH = 3;
export const BUSINESS_SLUG_MAX_LENGTH = 60;
export const BUSINESS_SLUG_PATTERN = "[a-z0-9]+(-[a-z0-9]+)*";

/** Local checks that need no network. Returns a user-facing message or null when the slug is acceptable. */
export function validateBusinessSlug(slug: string) {
  if (slug.length < BUSINESS_SLUG_MIN_LENGTH) return `La URL necesita al menos ${BUSINESS_SLUG_MIN_LENGTH} caracteres.`;
  if (slug.length > BUSINESS_SLUG_MAX_LENGTH) return `La URL puede tener hasta ${BUSINESS_SLUG_MAX_LENGTH} caracteres.`;
  if (!new RegExp(`^${BUSINESS_SLUG_PATTERN}$`).test(slug)) return "Usá solo letras minúsculas, números y guiones simples.";
  if (RESERVED_BUSINESS_SLUGS.has(slug)) return "Esa URL está reservada. Elegí otra.";
  return null;
}

export function suggestBusinessSlug(name: string) {
  return slugifyBusinessName(name);
}

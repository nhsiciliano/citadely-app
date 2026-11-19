import { CalendarDays, Globe2, LayoutDashboard, Settings, Sparkles, UsersRound, type LucideIcon } from "lucide-react";

// Módulo sin "use client": el layout del servidor lee SIDEBAR_COOKIE y el lateral usa el resto.

export const SIDEBAR_ID = "navegacion-principal";
export const SIDEBAR_COOKIE = "citadely_sidebar";
/** Mismo corte que `lg:` de Tailwind: debajo, el lateral es un drawer y nunca se colapsa. */
export const DESKTOP_QUERY = "(min-width: 64rem)";
/** Anchos finales de escritorio; `--workspace-sidebar-width` los publica para los drawers (globals.css). */
export const SIDEBAR_WIDTH = { expanded: 256, collapsed: 72 } as const;

export type NavSection = "operacion" | "negocio";
export type NavItem = { href: string; label: string; icon: LucideIcon; section: NavSection };

/** Grupos rotulados del lateral, en orden; cada destino declara el suyo en NAV_ITEMS. */
export const NAV_SECTIONS: readonly { id: NavSection; title: string }[] = [
  { id: "operacion", title: "Operación" },
  { id: "negocio", title: "Negocio" },
];

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/negocio", label: "Inicio", icon: LayoutDashboard, section: "operacion" },
  { href: "/negocio/agenda", label: "Agenda", icon: CalendarDays, section: "operacion" },
  { href: "/negocio/servicios", label: "Servicios", icon: Sparkles, section: "operacion" },
  { href: "/negocio/clientes", label: "Clientes", icon: UsersRound, section: "operacion" },
  { href: "/negocio/pagina-publica", label: "Página pública", icon: Globe2, section: "negocio" },
  { href: "/negocio/configuracion", label: "Configuración", icon: Settings, section: "negocio" },
];

export function isNavItemActive(href: string, pathname: string) {
  return href === "/negocio" ? pathname === href : pathname.startsWith(href);
}

export function parseSidebarCookie(value: string | undefined) {
  return value === "collapsed";
}

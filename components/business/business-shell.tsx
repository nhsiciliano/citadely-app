"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { isClientProduction } from "@/lib/env";
import { SIDEBAR_ID, SIDEBAR_WIDTH } from "./sidebar/constants";
import { SidebarA } from "./sidebar/sidebar-a";
import { SidebarB } from "./sidebar/sidebar-b";
import type { SidebarModelProps } from "./sidebar/shared";
import { useSidebarCollapse } from "./sidebar/use-sidebar-collapse";
import { SidebarVariantSwitcher, useSidebarVariant, type SidebarVariant } from "./sidebar/variant-switcher"; // TEMP(sidebar-variants)
import { useWorkspace } from "./workspace-context";

const LEGACY_HASHES: Record<string, string> = {
  "#agenda": "/negocio/agenda",
  "#servicios": "/negocio/servicios",
  "#clientes": "/negocio/clientes",
  "#pagina": "/negocio/pagina-publica",
};

// TEMP(sidebar-variants): en S6 queda un único modelo y este mapa desaparece.
const SIDEBAR_MODELS: Record<SidebarVariant, (props: SidebarModelProps) => ReactNode> = { a: SidebarA, b: SidebarB, c: SidebarA };

// Contenedor del panel: skip-link, drawer móvil (overlay, Escape, `inert` en main) y el área principal.
// El lateral en sí lo dibuja el modelo elegido.
export function BusinessShell({ children, initialCollapsed }: { children: ReactNode; initialCollapsed: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { error } = useWorkspace();
  const { collapsed, toggle } = useSidebarCollapse(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const variant = useSidebarVariant(); // TEMP(sidebar-variants)
  const Sidebar = SIDEBAR_MODELS[variant];
  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    if (!mobileOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMobileOpen(false);
      menuButtonRef.current?.focus();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  useEffect(() => {
    if (pathname !== "/negocio") return;
    const target = LEGACY_HASHES[window.location.hash];
    if (target) router.replace(target);
  }, [pathname, router]);

  const sidebarWidth = collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded;

  return (
    <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[auto_minmax(0,1fr)]" style={{ "--workspace-sidebar-width": `${sidebarWidth}px` } as CSSProperties}>
      <a className="skip-link" href="#contenido-principal">Saltar al contenido</a>

      <button
        aria-controls={SIDEBAR_ID}
        aria-expanded={mobileOpen}
        aria-label="Abrir navegación"
        ref={menuButtonRef}
        className="fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-md bg-navy text-white shadow-raised lg:hidden"
        onClick={() => setMobileOpen(true)}
        type="button"
      >
        <Menu aria-hidden="true" size={21} />
      </button>

      {mobileOpen ? <button aria-label="Cerrar navegación" className="fixed inset-0 z-40 bg-[rgba(4,20,42,.48)] lg:hidden" onClick={closeMobile} type="button" /> : null}

      <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onNavigate={closeMobile} onToggle={toggle} />

      <main className="min-w-0" id="contenido-principal" inert={mobileOpen}>
        {error ? <p className="border-b border-danger-line bg-danger-soft px-5 py-3 text-sm font-semibold text-danger" role="alert">{error}</p> : null}
        {children}
      </main>

      {isClientProduction ? null : <SidebarVariantSwitcher current={variant} />}
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronsLeft, LogOut } from "lucide-react";
import { LogoSymbol } from "@/components/ui";
import { useWorkspace } from "../workspace-context";
import { BusinessAvatar } from "./business-avatar";
import { NAV_ITEMS, isNavItemActive, type NavItem } from "./constants";
import { MobileCloseButton, SidebarFrame, SidebarLabel, SidebarNavLink, collapseToggleProps, type SidebarModelProps } from "./shared";
import { SidebarTooltip } from "./sidebar-tooltip";

const SECTIONS: { id: NavItem["section"]; title: string }[] = [
  { id: "operacion", title: "Operación" },
  { id: "negocio", title: "Negocio" },
];

const ROW = "flex w-full items-center gap-3 rounded-md pl-[14px] pr-3 text-left text-sm font-medium";
const IDLE = "text-white/70 hover:bg-white/[0.06] hover:text-white";

/**
 * Modelo B · secciones y control al pie. El negocio vive en un bloque elevado con acceso directo a su
 * página pública; la navegación se agrupa por intención y el colapso es una fila completa al pie.
 */
export function SidebarB({ collapsed, mobileOpen, onNavigate, onToggle }: SidebarModelProps) {
  const pathname = usePathname();
  const { business, publicUrl, signOut, userEmail } = useWorkspace();
  const publicAddress = publicUrl.replace(/^https?:\/\//, "");

  return (
    <SidebarFrame className="bg-navy text-white" collapsed={collapsed} mobileOpen={mobileOpen} tone="dark">
      <div className="flex h-16 shrink-0 items-center gap-3 pl-5 pr-3">
        <LogoSymbol className="h-8 w-8" />
        <SidebarLabel className="text-lg font-semibold tracking-[-0.03em]">Citadely</SidebarLabel>
        <MobileCloseButton className="text-white/70 hover:bg-white/10 hover:text-white" onClose={onNavigate} />
      </div>

      <div className="mx-2 shrink-0 overflow-hidden rounded-lg bg-navy-raised p-2 ring-1 ring-white/[0.08] ring-inset">
        <div className="flex items-center gap-3">
          <SidebarTooltip enabled={collapsed} label={business.name}>
            <BusinessAvatar logoUrl={business.logo_url} name={business.name} />
          </SidebarTooltip>
          <span className="ws-label">
            <span className="block truncate text-sm font-semibold">{business.name}</span>
            <span className="mt-0.5 flex items-center gap-1.5 text-xs text-white/60">
              {business.is_demo ? <span className="shrink-0 rounded-full bg-white/10 px-1.5 text-[11px] font-semibold leading-[18px] text-white/80">Demo</span> : null}
              <span className="min-w-0 truncate">{business.is_public ? publicAddress : "Página sin publicar"}</span>
            </span>
          </span>
          {business.is_public ? (
            <a
              aria-label="Abrir página pública"
              className="ws-hideable grid h-11 w-9 shrink-0 place-items-center rounded-md text-white/65 hover:bg-white/10 hover:text-white"
              href={publicUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <ArrowUpRight aria-hidden="true" size={18} strokeWidth={1.8} />
            </a>
          ) : null}
        </div>
      </div>

      <nav aria-label="Navegación del negocio" className="mt-2 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
        {SECTIONS.map((section) => (
          <div aria-labelledby={`navegacion-seccion-${section.id}`} className="mt-4 first:mt-0" key={section.id} role="group">
            <div className="relative flex h-8 items-center pl-[14px]">
              <span className="ws-label text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55" id={`navegacion-seccion-${section.id}`}>
                {section.title}
              </span>
              <span aria-hidden="true" className="ws-collapsed-only absolute inset-x-2 top-1/2 h-px bg-white/15" />
            </div>
            <div className="space-y-1">
              {NAV_ITEMS.filter((item) => item.section === section.id).map((item) => {
                const active = isNavItemActive(item.href, pathname);
                return (
                  <SidebarNavLink
                    active={active}
                    className={`relative min-h-11 ${ROW} ${active ? "bg-white/10 text-white" : IDLE}`}
                    collapsed={collapsed}
                    item={item}
                    key={item.href}
                    onNavigate={onNavigate}
                  >
                    {active ? <span aria-hidden="true" className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-primary" /> : null}
                  </SidebarNavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 px-3 py-2">
        <SidebarTooltip enabled={collapsed} label="Cerrar sesión">
          <button className={`min-h-[52px] ${ROW} ${IDLE}`} onClick={signOut} type="button">
            <LogOut aria-hidden="true" className="shrink-0" size={19} strokeWidth={1.8} />
            <span className="ws-label">
              <span className="block">Cerrar sesión</span>
              <span className="block truncate text-xs font-normal text-white/60">{userEmail}</span>
            </span>
          </button>
        </SidebarTooltip>
        <div className="mt-1 hidden border-t border-white/10 pt-1 lg:block">
          <SidebarTooltip enabled label={collapsed ? "Expandir navegación" : "Contraer navegación"} shortcut>
            <button {...collapseToggleProps(collapsed, onToggle)} className={`min-h-11 ${ROW} ${IDLE}`}>
              <ChevronsLeft
                aria-hidden="true"
                className={`shrink-0 transition-transform duration-[240ms] ease-[cubic-bezier(.2,.8,.2,1)] ${collapsed ? "rotate-180" : ""}`}
                size={19}
                strokeWidth={1.8}
              />
              <SidebarLabel>Contraer navegación</SidebarLabel>
            </button>
          </SidebarTooltip>
        </div>
      </div>
    </SidebarFrame>
  );
}

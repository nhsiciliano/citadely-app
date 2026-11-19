"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CircleUserRound, ExternalLink, LogOut, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { LogoSymbol } from "@/components/ui";
import { useWorkspace } from "../workspace-context";
import { BusinessAvatar } from "./business-avatar";
import { NAV_ITEMS, NAV_SECTIONS, SIDEBAR_ID, isNavItemActive, type NavItem } from "./constants";
import { SidebarTooltip } from "./sidebar-tooltip";

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  /** Cierra el drawer móvil al elegir un destino. */
  onNavigate: () => void;
};

const ROW = "flex min-h-11 w-full items-center gap-3 rounded-md pl-[14px] pr-3 text-left text-sm font-medium";
const IDLE = "text-white/70 hover:bg-white/8 hover:text-white";

/**
 * Lateral del panel sobre azul noche: el negocio arriba con el control de colapso en la misma fila,
 * destinos agrupados en "Operación" y "Negocio", activo relleno de cobalto y la firma de Citadely al
 * pie. Drawer desde la izquierda en móvil; columna sticky de 256 ↔ 72 px en escritorio. El ancho, el
 * desplazamiento y lo que se desvanece al colapsar viven en globals.css (`.ws-sidebar`) porque las
 * reglas base de `a`/`button` no tienen capa y pisarían las utilidades de transición de Tailwind.
 */
export function Sidebar({ collapsed, mobileOpen, onNavigate, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { business, publicUrl, signOut, userEmail } = useWorkspace();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? "Expandir navegación" : "Contraer navegación";

  return (
    <aside
      className="ws-sidebar fixed inset-y-0 left-0 z-50 flex flex-col bg-navy text-white lg:sticky lg:top-0 lg:h-screen"
      data-collapsed={collapsed}
      data-mobile-open={mobileOpen}
      id={SIDEBAR_ID}
    >
      <div className="ws-header relative shrink-0 border-b border-white/10">
        <div className="flex h-[72px] items-center gap-3 pl-4 pr-3 lg:pr-[64px]">
          <SidebarTooltip enabled={collapsed} label={business.name}>
            <BusinessAvatar logoUrl={business.logo_url} name={business.name} />
          </SidebarTooltip>
          {/* El nombre ocupa hasta dos líneas. El bloque tiene el ancho del lateral expandido (286 − 136 en
              el drawer, 256 − 132 en escritorio) para que, mientras el ancho anima, `.ws-label` lo recorte
              y desvanezca sin que el texto se reacomode ni cambie de alto. */}
          <span className="ws-label">
            <span className="block w-[150px] whitespace-normal lg:w-[124px]">
              <span className="line-clamp-2 break-words text-sm font-semibold">{business.name}</span>
              {business.is_demo ? <span className="mt-0.5 block truncate text-xs text-white/60">Cuenta demo</span> : null}
            </span>
          </span>
          <button
            aria-label="Cerrar navegación"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onNavigate}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </div>
        <SidebarTooltip enabled label={toggleLabel} shortcut>
          <button
            aria-controls={SIDEBAR_ID}
            aria-expanded={!collapsed}
            aria-keyshortcuts="Control+B Meta+B"
            aria-label={toggleLabel}
            className="ws-toggle hidden h-11 w-11 place-items-center rounded-md text-white/65 hover:bg-white/10 hover:text-white lg:grid"
            onClick={onToggle}
            type="button"
          >
            <ToggleIcon aria-hidden="true" size={19} strokeWidth={1.8} />
          </button>
        </SidebarTooltip>
      </div>

      <nav aria-label="Navegación del negocio" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {NAV_SECTIONS.map((section, index) => {
          const headingId = `navegacion-seccion-${section.id}`;
          return (
            <div aria-labelledby={headingId} className="mt-4 first:mt-0" key={section.id} role="group">
              {/* Altura fija en ambos estados: el rótulo se desvanece y aparece un divisor, los íconos no saltan. */}
              <div className="relative flex h-8 items-center pl-[14px]">
                <span className="ws-label text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55" id={headingId}>
                  {section.title}
                </span>
                {/* El primer grupo no lleva divisor: ya lo separa el borde de la cabecera. */}
                {index > 0 ? <span aria-hidden="true" className="ws-collapsed-only absolute inset-x-2 top-1/2 h-px bg-white/15" /> : null}
              </div>
              <div className="space-y-1">
                {NAV_ITEMS.filter((item) => item.section === section.id).map((item) => (
                  <NavLink active={isNavItemActive(item.href, pathname)} collapsed={collapsed} item={item} key={item.href} onNavigate={onNavigate} />
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-white/10 px-3 py-3">
        {business.is_public ? (
          <SidebarTooltip enabled={collapsed} label="Abrir página pública">
            <a className={`${ROW} ${IDLE}`} href={publicUrl} rel="noopener noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" className="shrink-0" size={19} strokeWidth={1.8} />
              <Label>Abrir página pública</Label>
            </a>
          </SidebarTooltip>
        ) : null}
        <SidebarTooltip enabled={collapsed} label="Cerrar sesión">
          <button className={`${ROW} ${IDLE}`} onClick={signOut} type="button">
            <LogOut aria-hidden="true" className="shrink-0" size={19} strokeWidth={1.8} />
            <Label>Cerrar sesión</Label>
          </button>
        </SidebarTooltip>
        <div className="mt-3 border-t border-white/10 pt-2">
          <SidebarTooltip enabled={collapsed} label={userEmail}>
            <div className="flex min-h-10 items-center gap-3 pl-[14px] pr-3 text-white/70">
              <CircleUserRound aria-hidden="true" className="shrink-0" size={19} strokeWidth={1.8} />
              <Label className="text-xs text-ellipsis">{userEmail}</Label>
            </div>
          </SidebarTooltip>
          <div className="flex h-9 items-center gap-2.5 pl-3">
            <LogoSymbol className="h-6 w-6" />
            <Label className="text-xs font-semibold tracking-[-0.01em] text-white/60">Citadely</Label>
          </div>
        </div>
      </div>
    </aside>
  );
}

/** Texto que se desvanece y se recorta al colapsar; nunca `display: none`, así no hay reflujo. */
function Label({ className = "", children }: { className?: string; children: ReactNode }) {
  return <span className={`ws-label ${className}`}>{children}</span>;
}

function NavLink({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate: () => void }) {
  const Icon = item.icon;
  return (
    <SidebarTooltip enabled={collapsed} label={item.label}>
      <Link aria-current={active ? "page" : undefined} className={`ws-item ${ROW} ${active ? "bg-primary text-white" : IDLE}`} href={item.href} onClick={onNavigate}>
        <Icon aria-hidden="true" className="shrink-0" size={19} strokeWidth={1.8} />
        <Label>{item.label}</Label>
      </Link>
    </SidebarTooltip>
  );
}

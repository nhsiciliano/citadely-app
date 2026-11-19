"use client";

import { usePathname } from "next/navigation";
import { CircleUserRound, ExternalLink, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { LogoSymbol } from "@/components/ui";
import { useWorkspace } from "../workspace-context";
import { BusinessAvatar } from "./business-avatar";
import { NAV_ITEMS, isNavItemActive } from "./constants";
import { MobileCloseButton, SidebarFrame, SidebarLabel, SidebarNavLink, collapseToggleProps, type SidebarModelProps } from "./shared";
import { SidebarTooltip } from "./sidebar-tooltip";

const ROW = "flex min-h-11 w-full items-center gap-3 rounded-md pl-[14px] pr-3 text-left text-sm font-medium";
const IDLE = "text-white/70 hover:bg-white/8 hover:text-white";

/**
 * Modelo A · riel de marca. Evolución fiel al DESIGN.md: azul noche, activo relleno de cobalto, el
 * negocio arriba con el control de colapso en la misma fila y la firma de Citadely reducida al pie.
 */
export function SidebarA({ collapsed, mobileOpen, onNavigate, onToggle }: SidebarModelProps) {
  const pathname = usePathname();
  const { business, publicUrl, signOut, userEmail } = useWorkspace();
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <SidebarFrame className="bg-navy text-white" collapsed={collapsed} mobileOpen={mobileOpen} tone="dark">
      <div className="ws-a-header relative shrink-0 border-b border-white/10">
        <div className="flex h-[72px] items-center gap-3 pl-4 pr-3 lg:pr-[64px]">
          <SidebarTooltip enabled={collapsed} label={business.name}>
            <BusinessAvatar logoUrl={business.logo_url} name={business.name} />
          </SidebarTooltip>
          <span className="ws-label">
            <span className="block truncate text-sm font-semibold">{business.name}</span>
            {business.is_demo ? <span className="mt-0.5 block truncate text-xs text-white/60">Cuenta demo · datos ficticios</span> : null}
          </span>
          <MobileCloseButton className="text-white/70 hover:bg-white/10 hover:text-white" onClose={onNavigate} />
        </div>
        <SidebarTooltip enabled label={collapsed ? "Expandir navegación" : "Contraer navegación"} shortcut>
          <button {...collapseToggleProps(collapsed, onToggle)} className="ws-a-toggle hidden h-11 w-11 place-items-center rounded-md text-white/65 hover:bg-white/10 hover:text-white lg:grid">
            <ToggleIcon aria-hidden="true" size={19} strokeWidth={1.8} />
          </button>
        </SidebarTooltip>
      </div>

      <nav aria-label="Navegación del negocio" className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          return (
            <SidebarNavLink
              active={active}
              className={`${ROW} ${active ? "bg-primary text-white" : IDLE}`}
              collapsed={collapsed}
              item={item}
              key={item.href}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>

      <div className="shrink-0 space-y-1 border-t border-white/10 px-3 py-3">
        {business.is_public ? (
          <SidebarTooltip enabled={collapsed} label="Abrir página pública">
            <a className={`${ROW} ${IDLE}`} href={publicUrl} rel="noopener noreferrer" target="_blank">
              <ExternalLink aria-hidden="true" className="shrink-0" size={19} strokeWidth={1.8} />
              <SidebarLabel>Abrir página pública</SidebarLabel>
            </a>
          </SidebarTooltip>
        ) : null}
        <SidebarTooltip enabled={collapsed} label="Cerrar sesión">
          <button className={`${ROW} ${IDLE}`} onClick={signOut} type="button">
            <LogOut aria-hidden="true" className="shrink-0" size={19} strokeWidth={1.8} />
            <SidebarLabel>Cerrar sesión</SidebarLabel>
          </button>
        </SidebarTooltip>
        <div className="mt-3 border-t border-white/10 pt-2">
          <SidebarTooltip enabled={collapsed} label={userEmail}>
            <div className="flex min-h-10 items-center gap-3 pl-[14px] pr-3 text-white/70">
              <CircleUserRound aria-hidden="true" className="shrink-0" size={19} strokeWidth={1.8} />
              <SidebarLabel className="text-xs text-ellipsis">{userEmail}</SidebarLabel>
            </div>
          </SidebarTooltip>
          <div className="flex h-9 items-center gap-2.5 pl-3">
            <LogoSymbol className="h-6 w-6" />
            <SidebarLabel className="text-xs font-semibold tracking-[-0.01em] text-white/60">Citadely</SidebarLabel>
          </div>
        </div>
      </div>
    </SidebarFrame>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, ExternalLink, LogOut, UserRound } from "lucide-react";
import { LogoSymbol } from "@/components/ui";
import { useWorkspace } from "../workspace-context";
import { BusinessAvatar } from "./business-avatar";
import { NAV_ITEMS, isNavItemActive } from "./constants";
import { MobileCloseButton, SidebarFrame, SidebarLabel, SidebarNavLink, collapseToggleProps, type SidebarModelProps } from "./shared";
import { SidebarTooltip } from "./sidebar-tooltip";

const ACCOUNT_MENU_ID = "menu-cuenta";

/**
 * Modelo C · lateral claro. Superficie blanca con regla fría, activo en niebla cobalto, cuenta al pie
 * con menú compacto y colapso por una manija sobre el borde derecho. Se aparta del DESIGN.md (la
 * navegación vive sobre azul noche): si se elige, el documento se actualiza en S6.
 */
export function SidebarC({ collapsed, mobileOpen, onNavigate, onToggle }: SidebarModelProps) {
  const pathname = usePathname();
  const { business } = useWorkspace();

  return (
    <SidebarFrame className="border-r border-line bg-surface text-ink-soft" collapsed={collapsed} mobileOpen={mobileOpen} tone="light">
      <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-line pl-4 pr-3">
        <SidebarTooltip enabled={collapsed} label={business.name}>
          <BusinessAvatar logoUrl={business.logo_url} name={business.name} tone="light" />
        </SidebarTooltip>
        <span className="ws-label">
          <span className="block truncate text-sm font-semibold text-ink">{business.name}</span>
          {business.is_demo ? <span className="mt-0.5 block truncate text-xs text-ink-muted">Cuenta demo · datos ficticios</span> : null}
        </span>
        <MobileCloseButton className="text-ink-soft hover:bg-canvas hover:text-ink" onClose={onNavigate} />
      </div>

      <nav aria-label="Navegación del negocio" className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item.href, pathname);
          return (
            <SidebarNavLink
              active={active}
              className={`flex min-h-11 w-full items-center gap-3 rounded-md pl-[14px] pr-3 text-sm font-medium ${active ? "bg-primary-soft text-primary" : "text-ink-soft hover:bg-canvas hover:text-ink"}`}
              collapsed={collapsed}
              item={item}
              key={item.href}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-line px-3 py-3">
        <AccountMenu collapsed={collapsed} />
        <div className="flex h-9 items-center gap-2.5 pl-3">
          <LogoSymbol className="h-6 w-6" />
          <SidebarLabel className="text-xs font-semibold tracking-[-0.01em] text-ink-muted">Citadely</SidebarLabel>
        </div>
      </div>

      <SidebarTooltip enabled label={collapsed ? "Expandir navegación" : "Contraer navegación"} shortcut>
        <button {...collapseToggleProps(collapsed, onToggle)} className="ws-c-handle hidden lg:grid">
          <span aria-hidden="true" className="ws-c-handle-pill" />
        </button>
      </SidebarTooltip>
    </SidebarFrame>
  );
}

/** Cuenta al pie: un disclosure (no un role="menu") con la página pública y el cierre de sesión. */
function AccountMenu({ collapsed }: { collapsed: boolean }) {
  const { business, publicUrl, signOut, userEmail } = useWorkspace();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div
      className="relative"
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      ref={rootRef}
    >
      <SidebarTooltip enabled={collapsed && !open} label="Tu cuenta">
        <button
          aria-controls={ACCOUNT_MENU_ID}
          aria-expanded={open}
          className="flex min-h-[52px] w-full items-center gap-3 rounded-md pl-[10px] pr-2 text-left hover:bg-canvas"
          onClick={() => setOpen((value) => !value)}
          ref={buttonRef}
          type="button"
        >
          <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-canvas text-ink-soft ring-1 ring-line ring-inset">
            <UserRound size={15} strokeWidth={1.9} />
          </span>
          <span className="ws-label flex items-center gap-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-semibold text-ink">Tu cuenta</span>
              <span className="block truncate text-xs text-ink-muted">{userEmail}</span>
            </span>
            <ChevronsUpDown aria-hidden="true" className="shrink-0 text-ink-muted" size={16} />
          </span>
        </button>
      </SidebarTooltip>

      {open ? (
        <div
          className={`absolute inset-x-0 bottom-[calc(100%+6px)] z-20 rounded-md border border-line bg-surface p-1 shadow-raised ${collapsed ? "lg:right-auto lg:bottom-0 lg:left-[calc(100%+12px)] lg:w-64" : ""}`}
          id={ACCOUNT_MENU_ID}
        >
          <p className="truncate border-b border-line px-3 pt-1.5 pb-2.5 text-xs text-ink-muted">{userEmail}</p>
          <div className="pt-1">
            {business.is_public ? (
              <a
                className="flex min-h-11 items-center gap-3 rounded px-3 text-sm font-medium text-ink hover:bg-canvas"
                href={publicUrl}
                onClick={() => setOpen(false)}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" className="shrink-0 text-ink-soft" size={18} strokeWidth={1.8} />
                Abrir página pública
              </a>
            ) : null}
            <button className="flex min-h-11 w-full items-center gap-3 rounded px-3 text-left text-sm font-medium text-ink hover:bg-canvas" onClick={signOut} type="button">
              <LogOut aria-hidden="true" className="shrink-0 text-ink-soft" size={18} strokeWidth={1.8} />
              Cerrar sesión
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

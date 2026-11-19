"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { SIDEBAR_ID, type NavItem } from "./constants";
import { SidebarTooltip } from "./sidebar-tooltip";

/** Lo que el shell le pasa a cada modelo de lateral. */
export type SidebarModelProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  /** Cierra el drawer móvil al elegir un destino. */
  onNavigate: () => void;
};

/**
 * Contenedor común: drawer desde la izquierda en móvil, columna sticky en escritorio. El ancho, el
 * desplazamiento y lo que se oculta al colapsar viven en globals.css (`.ws-sidebar`) porque las reglas
 * base de `a`/`button` no tienen capa y pisarían las utilidades de transición de Tailwind.
 */
export function SidebarFrame({
  collapsed,
  mobileOpen,
  tone,
  className,
  children,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  tone: "dark" | "light";
  className: string;
  children: ReactNode;
}) {
  return (
    <aside
      className={`ws-sidebar fixed inset-y-0 left-0 z-50 flex flex-col lg:sticky lg:top-0 lg:h-screen ${className}`}
      data-collapsed={collapsed}
      data-mobile-open={mobileOpen}
      data-tone={tone}
      id={SIDEBAR_ID}
    >
      {children}
    </aside>
  );
}

/** Texto que se desvanece y se recorta al colapsar; nunca `display: none`, así no hay reflujo. */
export function SidebarLabel({ className = "", children }: { className?: string; children: ReactNode }) {
  return <span className={`ws-label ${className}`}>{children}</span>;
}

export function MobileCloseButton({ onClose, className }: { onClose: () => void; className: string }) {
  return (
    <button aria-label="Cerrar navegación" className={`grid h-11 w-11 shrink-0 place-items-center rounded-md lg:hidden ${className}`} onClick={onClose} type="button">
      <X aria-hidden="true" size={20} />
    </button>
  );
}

export function collapseToggleProps(collapsed: boolean, onToggle: () => void) {
  return {
    "aria-controls": SIDEBAR_ID,
    "aria-expanded": !collapsed,
    "aria-keyshortcuts": "Control+B Meta+B",
    "aria-label": collapsed ? "Expandir navegación" : "Contraer navegación",
    onClick: onToggle,
    type: "button" as const,
  };
}

/** Destino de la navegación con tooltip en modo colapsado; cada modelo define su piel con `className`. */
export function SidebarNavLink({
  item,
  active,
  collapsed,
  onNavigate,
  className,
  children,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
  className: string;
  children?: ReactNode;
}) {
  const Icon = item.icon;
  return (
    <SidebarTooltip enabled={collapsed} label={item.label}>
      <Link aria-current={active ? "page" : undefined} className={`ws-item ${className}`} href={item.href} onClick={onNavigate}>
        {children}
        <Icon aria-hidden="true" className="shrink-0" size={19} strokeWidth={1.8} />
        <SidebarLabel>{item.label}</SidebarLabel>
      </Link>
    </SidebarTooltip>
  );
}

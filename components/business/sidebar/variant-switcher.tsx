"use client";

// TEMP(sidebar-variants): todo este archivo se borra en S6, cuando el usuario elija un modelo.

import { useEffect, useSyncExternalStore } from "react";

export type SidebarVariant = "a" | "b" | "c";

const STORAGE_KEY = "citadely_sidebar_variant";
const CHANGE_EVENT = "citadely:sidebar-variant";
const VARIANTS: readonly SidebarVariant[] = ["a", "b", "c"];

function parseVariant(value: string | null | undefined): SidebarVariant | null {
  const normalized = value?.trim().toLowerCase();
  return VARIANTS.find((variant) => variant === normalized) ?? null;
}

function readVariant(): SidebarVariant {
  try {
    return parseVariant(window.localStorage.getItem(STORAGE_KEY)) ?? "a";
  } catch {
    return "a";
  }
}

function writeVariant(variant: SidebarVariant) {
  try {
    window.localStorage.setItem(STORAGE_KEY, variant);
  } catch {
    // Sin storage (modo privado estricto) el cambio dura solo hasta recargar.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** Modelo elegido: `?sidebar=a|b|c` lo guarda en localStorage; el servidor siempre pinta A. */
export function useSidebarVariant() {
  useEffect(() => {
    const fromQuery = parseVariant(new URLSearchParams(window.location.search).get("sidebar"));
    if (fromQuery) writeVariant(fromQuery);
  }, []);
  return useSyncExternalStore(subscribe, readVariant, () => "a" as const);
}

/** Selector flotante A · B · C, visible solo fuera de producción y en escritorio. */
export function SidebarVariantSwitcher({ current }: { current: SidebarVariant }) {
  return (
    <div aria-label="Modelo de menú lateral (temporal)" className="ws-variant-switcher" data-temp-sidebar-switcher="" role="group">
      <span className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">Menú</span>
      {VARIANTS.map((variant) => (
        <button
          aria-label={`Modelo ${variant.toUpperCase()}`}
          aria-pressed={current === variant}
          className="ws-variant-option"
          key={variant}
          onClick={() => writeVariant(variant)}
          type="button"
        >
          {variant.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

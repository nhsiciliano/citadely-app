"use client";

import { useCallback, useEffect, useState } from "react";
import { DESKTOP_QUERY, SIDEBAR_COOKIE } from "./constants";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.closest("input, textarea, select, [contenteditable='true']") !== null;
}

/**
 * Estado colapsado del lateral de escritorio. El valor inicial llega del layout (cookie leída en el
 * servidor), así el primer HTML ya sale con el ancho correcto y no hay parpadeo ni mismatch de
 * hidratación. Ctrl/⌘ + B alterna solo en escritorio y fuera de campos editables.
 */
export function useSidebarCollapse(initialCollapsed: boolean) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  useEffect(() => {
    const secure = window.location.protocol === "https:" ? "; secure" : "";
    document.cookie = `${SIDEBAR_COOKIE}=${collapsed ? "collapsed" : "expanded"}; path=/negocio; max-age=${ONE_YEAR_SECONDS}; samesite=lax${secure}`;
  }, [collapsed]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "b" || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      if (isEditableTarget(event.target) || !window.matchMedia(DESKTOP_QUERY).matches) return;
      event.preventDefault();
      setCollapsed((value) => !value);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggle = useCallback(() => setCollapsed((value) => !value), []);
  return { collapsed, toggle };
}

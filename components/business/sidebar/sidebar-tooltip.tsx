"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DESKTOP_QUERY } from "./constants";

type Position = { top: number; left: number };

/**
 * Tooltip propio del lateral colapsado: aparece al pasar el puntero y al enfocar con teclado
 * (no solo `title`), se descarta con Escape y se dibuja en un portal para no quedar recortado por
 * el scroll de la navegación. Es un duplicado visual: el nombre accesible ya lo da la etiqueta del
 * destino, que sigue en el DOM con opacidad cero.
 */
export function SidebarTooltip({
  label,
  enabled,
  shortcut = false,
  children,
}: {
  label: string;
  enabled: boolean;
  /** Agrega el atajo de colapso (⌘B / Ctrl B) a la burbuja. */
  shortcut?: boolean;
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const visible = enabled && position !== null;

  useEffect(() => {
    if (!visible) return;
    function hide() {
      setPosition(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hide();
    }
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
    };
  }, [visible]);

  function show() {
    const wrapper = wrapperRef.current;
    if (!enabled || !wrapper || !window.matchMedia(DESKTOP_QUERY).matches) return;
    // Se mide el control (puede estar posicionado en absoluto y dejar el envoltorio sin alto).
    const rect = (wrapper.firstElementChild ?? wrapper).getBoundingClientRect();
    // Alineado al borde del lateral, no al del destino, para que todas las burbujas formen una columna.
    const edge = wrapper.closest("aside")?.getBoundingClientRect().right ?? rect.right;
    setPosition({ top: rect.top + rect.height / 2, left: Math.max(edge, rect.right) + 10 });
  }

  function hide() {
    setPosition(null);
  }

  return (
    <div
      onBlur={hide}
      onFocus={(event) => {
        if (event.target instanceof Element && event.target.matches(":focus-visible")) show();
      }}
      onPointerDown={hide}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse" || event.pointerType === "pen") show();
      }}
      onPointerLeave={hide}
      ref={wrapperRef}
    >
      {children}
      {visible
        ? createPortal(
            <span aria-hidden="true" className="ws-tooltip" style={{ top: position.top, left: position.left }}>
              {label}
              {shortcut ? <kbd className="ws-tooltip-kbd">{isApplePlatform() ? "⌘B" : "Ctrl B"}</kbd> : null}
            </span>,
            document.body,
          )
        : null}
    </div>
  );
}

function isApplePlatform() {
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

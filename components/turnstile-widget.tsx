"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function loadScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.turnstile) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? Object.assign(document.createElement("script"), { src: SCRIPT_SRC, async: true });
    script.addEventListener("load", () => resolve(), { once: true });
    script.addEventListener("error", () => reject(new Error("turnstile")), { once: true });
    if (!existing) document.head.appendChild(script);
  });
}

/**
 * Optional bot challenge. Renders nothing unless NEXT_PUBLIC_TURNSTILE_SITE_KEY is set.
 * Tokens are single use: bump `resetSignal` after every submit to get a fresh one.
 */
export function TurnstileWidget({ onToken, resetSignal }: { onToken: (token: string) => void; resetSignal: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string>(undefined);
  const onTokenRef = useRef(onToken);

  useEffect(() => {
    onTokenRef.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;
    const container = containerRef.current;
    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(container, {
          sitekey: SITE_KEY,
          callback: (token: string) => onTokenRef.current(token),
          "expired-callback": () => onTokenRef.current(""),
          "error-callback": () => onTokenRef.current(""),
        });
      })
      .catch(() => onTokenRef.current(""));

    return () => {
      cancelled = true;
      if (widgetIdRef.current) window.turnstile?.remove(widgetIdRef.current);
      widgetIdRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current) {
      onTokenRef.current("");
      window.turnstile?.reset(widgetIdRef.current);
    }
  }, [resetSignal]);

  if (!SITE_KEY) return null;
  return <div ref={containerRef} className="mt-4" />;
}

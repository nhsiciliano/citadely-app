"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleUserRound,
  ExternalLink,
  Globe2,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";
import { LogoSymbol } from "@/components/ui";
import { getSubscriptionState } from "@/lib/citadely-db";
import { getBusinessPublicUrl } from "@/lib/urls";
import { useWorkspace } from "./workspace-context";

const NAV_ITEMS = [
  { href: "/negocio", label: "Inicio", icon: LayoutDashboard },
  { href: "/negocio/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/negocio/servicios", label: "Servicios", icon: Sparkles },
  { href: "/negocio/clientes", label: "Clientes", icon: UsersRound },
  { href: "/negocio/pagina-publica", label: "Página pública", icon: Globe2 },
  { href: "/negocio/configuracion", label: "Configuración", icon: Settings },
] as const;

const LEGACY_HASHES: Record<string, string> = {
  "#agenda": "/negocio/agenda",
  "#servicios": "/negocio/servicios",
  "#clientes": "/negocio/clientes",
  "#pagina": "/negocio/pagina-publica",
};

export function BusinessShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { business, signOut, userEmail } = useWorkspace();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const subscription = getSubscriptionState(business);
  const publicUrl = getBusinessPublicUrl(business.slug);
  const isDemoWorkspace = business.slug === "citadely-demo-ux" || userEmail.endsWith(".test");

  useEffect(() => {
    if (pathname !== "/negocio") return;
    const target = LEGACY_HASHES[window.location.hash];
    if (target) router.replace(target);
  }, [pathname, router]);

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] lg:grid lg:grid-cols-[auto_minmax(0,1fr)]" style={{ "--workspace-sidebar-width": collapsed ? "84px" : "256px" } as CSSProperties}>
      <a className="skip-link" href="#contenido-principal">Saltar al contenido</a>

      <button
        aria-label="Abrir navegación"
        className="fixed left-4 top-4 z-40 grid h-11 w-11 place-items-center rounded-md bg-[var(--color-navy)] text-white shadow-[var(--shadow-raised)] lg:hidden"
        onClick={() => setMobileOpen(true)}
        type="button"
      >
        <Menu aria-hidden="true" size={21} />
      </button>

      {mobileOpen ? <button aria-label="Cerrar navegación" className="fixed inset-0 z-40 bg-[rgba(4,20,42,.48)] lg:hidden" onClick={() => setMobileOpen(false)} type="button" /> : null}

      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[286px] flex-col bg-[var(--color-navy)] text-white transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} ${collapsed ? "lg:w-[84px]" : "lg:w-[256px]"}`}>
        <div className="flex h-20 items-center justify-between border-b border-white/10 px-5">
          <Link aria-label="Ir al inicio de Citadely" className="flex min-w-0 items-center gap-3" href="/negocio" onClick={() => setMobileOpen(false)}>
            <LogoSymbol />
            <span className={`text-xl font-semibold tracking-[-0.03em] ${collapsed ? "lg:hidden" : ""}`}>Citadely</span>
          </Link>
          <button aria-label="Cerrar navegación" className="grid h-10 w-10 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setMobileOpen(false)} type="button">
            <X aria-hidden="true" size={20} />
          </button>
        </div>

        <div className={`border-b border-white/10 px-5 py-4 ${collapsed ? "lg:px-3 lg:text-center" : ""}`}>
          <p className={`truncate text-sm font-semibold ${collapsed ? "lg:hidden" : ""}`}>{business.name}</p>
          <p className={`mt-1 text-xs text-white/55 ${collapsed ? "lg:hidden" : ""}`}>{isDemoWorkspace ? "Cuenta demo · datos ficticios" : subscription.isTrialing ? `${subscription.trialDaysLeft} días de prueba` : business.subscription_status === "active" ? "Plan activo" : "Acceso limitado"}</p>
          {collapsed ? <span className="hidden text-sm font-bold lg:inline">{business.name.slice(0, 1).toUpperCase()}</span> : null}
        </div>

        <nav aria-label="Navegación del negocio" className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = href === "/negocio" ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors ${active ? "bg-[var(--color-primary)] text-white" : "text-white/68 hover:bg-white/8 hover:text-white"} ${collapsed ? "lg:justify-center lg:px-0" : ""}`}
                href={href}
                key={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
              >
                <Icon aria-hidden="true" size={19} strokeWidth={1.8} />
                <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <Link className={`flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-white/68 hover:bg-white/8 hover:text-white ${collapsed ? "lg:justify-center lg:px-0" : ""}`} href={publicUrl} target="_blank">
            <ExternalLink aria-hidden="true" size={18} />
            <span className={collapsed ? "lg:hidden" : ""}>Abrir página pública</span>
          </Link>
          <button className={`mt-1 flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-white/68 hover:bg-white/8 hover:text-white ${collapsed ? "lg:justify-center lg:px-0" : ""}`} onClick={signOut} type="button">
            <LogOut aria-hidden="true" size={18} />
            <span className={collapsed ? "lg:hidden" : ""}>Cerrar sesión</span>
          </button>
          <div className={`mt-3 flex items-center gap-3 border-t border-white/10 px-3 pt-4 ${collapsed ? "lg:justify-center lg:px-0" : ""}`}>
            <CircleUserRound aria-hidden="true" className="shrink-0 text-white/70" size={25} />
            <div className={`min-w-0 ${collapsed ? "lg:hidden" : ""}`}>
              <p className="truncate text-xs font-semibold">{business.name}</p>
              <p className="mt-0.5 truncate text-[11px] text-white/65">{userEmail}</p>
            </div>
          </div>
        </div>

        <button aria-label={collapsed ? "Expandir navegación" : "Contraer navegación"} className="absolute -right-3 top-24 hidden h-7 w-7 place-items-center rounded-full border border-[var(--color-line)] bg-white text-[var(--color-navy)] shadow-sm lg:grid" onClick={() => setCollapsed((value) => !value)} type="button">
          {collapsed ? <ChevronRight aria-hidden="true" size={15} /> : <ChevronLeft aria-hidden="true" size={15} />}
        </button>
      </aside>

      <main className="min-w-0" id="contenido-principal">
        {children}
      </main>
    </div>
  );
}

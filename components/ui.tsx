import Link from "next/link";
import type { ReactNode } from "react";

export function LogoMark() {
  return (
    <Link className="flex items-center gap-3" href="/" aria-label="Citadely">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface-raised)] text-lg font-semibold text-[var(--reception)] shadow-sm">
        C
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-semibold tracking-[-0.03em]">
          Citadely
        </span>
        <span className="block text-xs font-medium uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          agenda viva
        </span>
      </span>
    </Link>
  );
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--reception)] px-6 text-sm font-semibold text-white shadow-sm hover:-translate-y-0.5 hover:bg-[#215d4d]"
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-12 items-center justify-center rounded-full border border-[var(--line-strong)] bg-[var(--surface)] px-6 text-sm font-semibold text-[var(--ink)] hover:-translate-y-0.5 hover:border-[var(--reception)]"
    >
      {children}
    </Link>
  );
}

export function AuthShell({
  title,
  subtitle,
  aside,
  children,
}: {
  title: string;
  subtitle: string;
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[var(--agenda-paper)] px-5 py-6 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <LogoMark />
        <section className="grid overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] shadow-sm lg:grid-cols-[1fr_0.9fr]">
          <div className="p-6 sm:p-10 lg:p-12">
            <div className="mb-9 max-w-xl">
              <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--terracotta)]">
                Acceso Citadely
              </p>
              <h1 className="text-3xl font-semibold tracking-[-0.05em] text-[var(--ink)] sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--ink-soft)]">
                {subtitle}
              </p>
            </div>
            {children}
          </div>
          <aside className="agenda-grid border-t border-[var(--line)] bg-[var(--agenda-paper-deep)] p-6 sm:p-10 lg:border-l lg:border-t-0">
            {aside}
          </aside>
        </section>
      </div>
    </main>
  );
}

export function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
      {label}
      <input
        className="min-h-12 rounded-2xl border border-[var(--line)] bg-white/70 px-4 text-base font-medium text-[var(--ink)] placeholder:text-[var(--ink-muted)] hover:border-[var(--line-strong)]"
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
      />
    </label>
  );
}

export function SubmitButton({ children, pending, disabled = false }: { children: ReactNode; pending: boolean; disabled?: boolean }) {
  return (
    <button
      className="flex min-h-12 w-full items-center justify-center rounded-full bg-[var(--reception)] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#215d4d] disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending || disabled}
      type="submit"
    >
      {pending ? "Procesando..." : children}
    </button>
  );
}

export function FormMessage({ type, children }: { type: "error" | "success"; children: ReactNode }) {
  return (
    <p
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${
        type === "error"
          ? "border-red-200 bg-red-50 text-[var(--danger)]"
          : "border-green-200 bg-green-50 text-[var(--reception)]"
      }`}
    >
      {children}
    </p>
  );
}

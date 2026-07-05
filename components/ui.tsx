import Link from "next/link";
import type { ReactNode } from "react";

export function LogoMark() {
  return (
    <Link className="flex items-center gap-3" href="/" aria-label="Citadely">
      <span className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-[var(--ink)] bg-[var(--surface-raised)] text-xl font-semibold tracking-[-0.08em] text-[var(--ink)] shadow-sm">
        C
        <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[var(--reception)]" />
        <span className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-[var(--surface-raised)] bg-[var(--ink)]" />
      </span>
      <span className="leading-tight">
        <span className="block text-xl font-semibold tracking-[-0.04em]">
          Citadely
        </span>
        <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]">
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

export function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.5h3.2c1.9-1.7 3.1-4.3 3.1-7.4Z" fill="#4285F4" />
      <path d="M12 22c2.7 0 5-0.9 6.7-2.4l-3.2-2.5c-.9.6-2 1-3.5 1-2.7 0-4.9-1.8-5.7-4.2H3v2.6A10 10 0 0 0 12 22Z" fill="#34A853" />
      <path d="M6.3 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.3-2.6Z" fill="#FBBC05" />
      <path d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.8 9.8 0 0 0 12 2a10 10 0 0 0-9 5.5l3.3 2.6C7.1 7.7 9.3 5.9 12 5.9Z" fill="#EA4335" />
    </svg>
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
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(62,119,145,0.14),transparent_32%),var(--agenda-paper)] px-5 py-6 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <LogoMark />
        <section className="grid overflow-hidden rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] shadow-[0_24px_80px_rgba(36,33,29,0.08)] lg:grid-cols-[1fr_0.9fr]">
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
          <aside className="agenda-grid border-t border-[var(--line)] bg-[linear-gradient(135deg,var(--agenda-paper-deep),#eef5f2)] p-6 sm:p-10 lg:border-l lg:border-t-0">
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
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  autoComplete?: string;
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
        autoComplete={autoComplete}
      />
    </label>
  );
}

export function TextArea({
  label,
  name,
  placeholder,
  required = true,
  defaultValue,
  rows = 4,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  rows?: number;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-[var(--ink)]">
      {label}
      <textarea
        className="min-h-28 resize-y rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-base font-medium leading-7 text-[var(--ink)] placeholder:text-[var(--ink-muted)] hover:border-[var(--line-strong)]"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        required={required}
        rows={rows}
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

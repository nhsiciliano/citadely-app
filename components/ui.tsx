import Link from "next/link";
import type { ChangeEvent, ReactNode } from "react";
import { ArrowRight } from "lucide-react";

export function LogoMark({ linked = true }: { linked?: boolean }) {
  const content = (
    <>
      <span className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-primary)] text-base font-bold text-white">C</span>
      <span className="text-xl font-semibold tracking-[-0.035em] text-[var(--color-navy)]">Citadely</span>
    </>
  );

  return linked
    ? <Link className="flex items-center gap-3" href="/" aria-label="Citadely, ir al inicio">{content}</Link>
    : <span className="flex items-center gap-3">{content}</span>;
}

export function PrimaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="button-primary"
    >
      {children}<ArrowRight aria-hidden="true" size={16} />
    </Link>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="button-secondary"
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
    <main className="min-h-screen bg-[var(--color-canvas)] px-5 py-6 sm:px-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <LogoMark />
        <section className="grid overflow-hidden border border-[var(--color-line)] bg-white shadow-[var(--shadow-raised)] lg:grid-cols-[1fr_0.9fr]">
          <div className="p-6 sm:p-10 lg:p-12">
            <div className="mb-9 max-w-xl">
              <h1 className="font-display text-3xl font-semibold tracking-[-0.035em] text-[var(--color-navy)] sm:text-5xl">
                {title}
              </h1>
              <p className="mt-4 text-base leading-7 text-[var(--color-ink-soft)]">
                {subtitle}
              </p>
            </div>
            {children}
          </div>
          <aside className="border-t border-[var(--color-line)] bg-[var(--color-navy)] p-6 text-white sm:p-10 lg:border-l lg:border-t-0">
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
    <label className="form-label">
      {label}
      <input
        className="form-control"
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
  onChange,
}: {
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
  rows?: number;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="form-label">
      {label}
      <textarea
        className="form-control min-h-28 resize-y"
        defaultValue={defaultValue}
        name={name}
        onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange?.(event.target.value)}
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
      className="button-primary w-full"
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
      aria-live={type === "error" ? "assertive" : "polite"}
      className={`border px-4 py-3 text-sm font-medium ${
        type === "error"
          ? "border-[var(--color-danger-line)] bg-[var(--color-danger-soft)] text-[var(--color-danger)]"
          : "border-[#a9dcca] bg-[var(--color-success-soft)] text-[var(--color-success)]"
      }`}
    >
      {children}
    </p>
  );
}

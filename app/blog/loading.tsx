export default function Loading() {
  return (
    <main className="grid min-h-[60vh] place-items-center bg-[var(--color-canvas)] px-5 py-16" role="status" aria-live="polite">
      <p className="text-[var(--color-ink-soft)]">Cargando…</p>
    </main>
  );
}

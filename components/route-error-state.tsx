"use client";

import { useEffect } from "react";

type RouteErrorStateProps = {
  error: Error & { digest?: string };
  unstable_retry: () => void;
  title: string;
  description: string;
};

export function RouteErrorState({ error, unstable_retry, title, description }: RouteErrorStateProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-[60vh] place-items-center bg-canvas px-5 py-16">
      <section className="max-w-xl border border-line bg-white p-8 text-center shadow-surface">
        <h1 className="font-display text-3xl font-semibold tracking-[-0.04em]">{title}</h1>
        <p className="mt-3 text-ink-soft">{description}</p>
        <button className="button-primary mt-6" type="button" onClick={() => unstable_retry()}>
          Intentar de nuevo
        </button>
      </section>
    </main>
  );
}

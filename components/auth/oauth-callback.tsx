"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getErrorMessage, getPostAuthPath } from "@/lib/auth";
import { insforge } from "@/lib/insforge";

export function OAuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function finishLogin() {
      // El SDK canjea insforge_code al iniciarse; getCurrentUser espera ese callback pendiente.
      const { data, error: userError } = await insforge.auth.getCurrentUser();
      if (!mounted) return;

      if (userError) {
        setError(getErrorMessage(userError));
        return;
      }

      if (!data.user) {
        setError("No pudimos completar el ingreso con Google. Probá de nuevo.");
        return;
      }

      router.replace(getPostAuthPath(data.user));
    }

    finishLogin();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (error) {
    return (
      <main className="grid min-h-[60vh] place-items-center px-5 py-16">
        <section className="grid max-w-md gap-4 text-center">
          <p className="text-ink-soft">{error}</p>
          <Link className="button-primary" href="/login">Volver a ingresar</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-[60vh] place-items-center px-5 py-16" role="status" aria-live="polite">
      <p className="text-ink-soft">Terminando de ingresar…</p>
    </main>
  );
}

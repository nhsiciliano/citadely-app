"use client";

import { RouteErrorState } from "@/components/route-error-state";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <RouteErrorState
      error={error}
      unstable_retry={unstable_retry}
      title="Algo salió mal"
      description="Hubo un problema al cargar el panel. Tus datos no se modificaron; probá de nuevo."
    />
  );
}

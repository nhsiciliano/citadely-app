"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  aprobado: "Pago aprobado. Tu turno quedó confirmado.",
  fallido: "El pago no se completó. Podés intentar reservar nuevamente.",
};
const PENDING_MESSAGE = "El pago quedó pendiente de confirmación.";

function Banner() {
  const pago = useSearchParams().get("pago");
  if (!pago) return null;
  return (
    <div className="mb-6 border border-line bg-white p-4 text-sm font-semibold text-ink-soft" role="status">
      {MESSAGES[pago] ?? PENDING_MESSAGE}
    </div>
  );
}

/** Reads ?pago in the browser so the public page itself can be cached without per-request search params. */
export function PaymentStatusBanner() {
  return (
    <Suspense fallback={null}>
      <Banner />
    </Suspense>
  );
}

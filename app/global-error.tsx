"use client";

import { useEffect } from "react";

// Reemplaza al layout raíz cuando falla, así que no puede usar sus estilos ni componentes.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 20,
          background: "#f7f7f5",
          color: "#111827",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <main style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, fontWeight: 600 }}>Algo salió mal</h1>
          <p style={{ marginTop: 12, color: "#4b5563" }}>Hubo un error inesperado. Probá de nuevo en unos segundos.</p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              marginTop: 24,
              minHeight: 44,
              padding: "0 16px",
              border: "1px solid #0957d9",
              borderRadius: 6,
              background: "#0957d9",
              color: "#fff",
              fontWeight: 650,
              cursor: "pointer",
            }}
          >
            Intentar de nuevo
          </button>
        </main>
      </body>
    </html>
  );
}

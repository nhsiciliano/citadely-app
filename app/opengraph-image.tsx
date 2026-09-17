import { ImageResponse } from "next/og";

export const alt = "Citadely — Agenda y turnos online para negocios";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#061a33",
          color: "white",
          display: "flex",
          height: "100%",
          justifyContent: "space-between",
          padding: "72px 84px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 780 }}>
          <div style={{ alignItems: "center", display: "flex", fontSize: 34, fontWeight: 700 }}>
            <div
              style={{
                alignItems: "center",
                background: "#0957d9",
                borderRadius: 12,
                display: "flex",
                height: 62,
                justifyContent: "center",
                marginRight: 20,
                width: 62,
              }}
            >
              C
            </div>
            Citadely
          </div>
          <div style={{ fontSize: 74, fontWeight: 700, letterSpacing: -3, lineHeight: 1.02, marginTop: 70 }}>
            Tu agenda y tus reservas, en un solo lugar.
          </div>
          <div style={{ color: "#b8c7db", fontSize: 28, lineHeight: 1.4, marginTop: 30 }}>
            Central de turnos para negocios de servicios.
          </div>
        </div>
        <div
          style={{
            border: "2px solid rgba(255,255,255,.18)",
            borderRadius: 999,
            color: "#d9e5f5",
            display: "flex",
            fontSize: 22,
            padding: "16px 24px",
          }}
        >
          citadely.com.ar
        </div>
      </div>
    ),
    size,
  );
}

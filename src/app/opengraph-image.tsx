import { ImageResponse } from "next/og";

// Dynamisch generiertes Vorschaubild für Link-Shares (WhatsApp, LinkedIn, Slack, ...)
export const alt =
  "Link2plan — Technische PDF-Pläne verwalten und verknüpfen";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0b1220 0%, #0f172a 55%, #12203b 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Wortmarke mit Marker-Pin */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              fontSize: 64,
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.02em",
            }}
          >
            Link2plan
          </span>
          <svg
            width="52"
            height="52"
            viewBox="0 0 24 24"
            fill="none"
            style={{ marginLeft: -2, marginBottom: 6 }}
          >
            <path
              d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
              stroke="#3b82f6"
              strokeWidth="2"
              fill="none"
            />
            <circle cx="12" cy="9" r="2.5" stroke="#3b82f6" strokeWidth="2" fill="none" />
          </svg>
        </div>

        {/* Haupt-Aussage */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 62,
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              maxWidth: 900,
            }}
          >
            Technische PDF-Pläne verwalten und verknüpfen
          </div>
          <div
            style={{
              marginTop: 28,
              fontSize: 32,
              color: "#94a3b8",
              lineHeight: 1.3,
              maxWidth: 860,
            }}
          >
            Setze klickbare Marker zwischen Grundrissen, Schnitten und
            Details — dein Team navigiert per Klick durch alle Pläne.
          </div>
        </div>

        {/* Fußzeile */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: 28, color: "#3b82f6", fontWeight: 600 }}>
            link2plan.de
          </span>
          <span style={{ fontSize: 24, color: "#64748b" }}>
            Für Techniker · Planer · Architekten · Ingenieure
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}

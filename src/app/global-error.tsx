"use client";

import { useEffect } from "react";
import { captureException } from "@/lib/sentry";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureException(error);
  }, [error]);

  return (
    <html lang="de">
      <body>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif" }}>
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>Fehler</h1>
            <p style={{ color: "#666", marginBottom: 24 }}>
              Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.
            </p>
            <button
              onClick={reset}
              style={{
                padding: "8px 24px",
                fontSize: 14,
                fontWeight: 500,
                borderRadius: 6,
                border: "1px solid #ddd",
                background: "#fff",
                cursor: "pointer",
              }}
            >
              Erneut versuchen
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}

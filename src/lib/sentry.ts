/**
 * Lightweight Sentry error reporting — no SDK needed.
 * Uses the Sentry Envelope API directly via fetch.
 * Works in both browser and server environments.
 */

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

function parseDsn(dsn: string) {
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace("/", "");
    const publicKey = url.username;
    const host = url.host;
    const protocol = url.protocol;
    return { projectId, publicKey, host, protocol };
  } catch {
    return null;
  }
}

const parsed = parseDsn(DSN);

function buildEnvelope(event: Record<string, unknown>) {
  if (!parsed) return null;

  const header = JSON.stringify({
    event_id: crypto.randomUUID().replace(/-/g, ""),
    dsn: DSN,
    sdk: { name: "link2plan", version: "1.0.0" },
    sent_at: new Date().toISOString(),
  });

  const itemHeader = JSON.stringify({
    type: "event",
    content_type: "application/json",
  });

  const payload = JSON.stringify({
    ...event,
    platform: "javascript",
    environment: process.env.NODE_ENV ?? "production",
    timestamp: Date.now() / 1000,
  });

  return `${header}\n${itemHeader}\n${payload}`;
}

function sendToSentry(event: Record<string, unknown>) {
  if (!parsed) return;

  const envelope = buildEnvelope(event);
  if (!envelope) return;

  const url = `${parsed.protocol}//${parsed.host}/api/${parsed.projectId}/envelope/?sentry_key=${parsed.publicKey}&sentry_version=7`;

  fetch(url, {
    method: "POST",
    body: envelope,
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
  }).catch(() => {
    // Silently fail — error reporting should never break the app
  });
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
) {
  if (!DSN) {
    console.error("[Error]", error);
    return;
  }

  const err = error instanceof Error ? error : new Error(String(error));

  sendToSentry({
    level: "error",
    exception: {
      values: [
        {
          type: err.name,
          value: err.message,
          stacktrace: err.stack
            ? {
                frames: err.stack
                  .split("\n")
                  .slice(1, 20)
                  .map((line) => ({ filename: line.trim() }))
                  .reverse(),
              }
            : undefined,
        },
      ],
    },
    extra: context,
    request:
      typeof window !== "undefined"
        ? { url: window.location.href, headers: { "User-Agent": navigator.userAgent } }
        : undefined,
  });
}

export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "log" | "info" | "debug" = "info"
) {
  if (!DSN) {
    console.warn("[Sentry]", message);
    return;
  }

  sendToSentry({
    level,
    message: { formatted: message },
    request:
      typeof window !== "undefined"
        ? { url: window.location.href }
        : undefined,
  });
}

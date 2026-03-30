/**
 * Sentry error reporting utility.
 *
 * When @sentry/nextjs is installed and NEXT_PUBLIC_SENTRY_DSN is set,
 * errors are sent to Sentry. Otherwise falls back to console.error.
 *
 * To enable:
 *   1. npm install @sentry/nextjs
 *   2. npx @sentry/wizard@latest -i nextjs
 *   3. Set NEXT_PUBLIC_SENTRY_DSN in .env.local
 *
 * Usage:
 *   import { captureException, captureMessage } from "@/lib/sentry";
 *   captureException(error);
 *   captureMessage("Something happened", "warning");
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _sentry: any = null;
let _loaded = false;

async function loadSentry() {
  if (_loaded) return _sentry;
  _loaded = true;
  try {
    // Dynamic import with string variable to prevent TypeScript from
    // resolving the module at build time
    const pkg = "@sentry/nextjs";
    _sentry = await import(/* webpackIgnore: true */ pkg);
  } catch {
    // Not installed — that's fine
  }
  return _sentry;
}

export function captureException(
  error: unknown,
  context?: Record<string, unknown>
) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    loadSentry().then((s) => s?.captureException(error, context));
  } else {
    console.error("[Error]", error);
  }
}

export function captureMessage(message: string, level?: string) {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    loadSentry().then((s) => s?.captureMessage(message, level));
  } else {
    console.warn("[Sentry]", message);
  }
}

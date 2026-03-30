/**
 * Simple in-memory sliding window rate limiter.
 * No external dependencies required.
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 60 seconds
const CLEANUP_INTERVAL_MS = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;

  for (const [key, entry] of store) {
    // Remove entries where ALL timestamps are older than any reasonable window (5 min max)
    const cutoff = now - 5 * 60_000;
    entry.timestamps = entry.timestamps.filter((t) => t > cutoff);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

/**
 * Check and record a rate-limited request.
 *
 * @param key      Unique identifier (e.g. "checkout:<ip>")
 * @param limit    Maximum number of requests allowed in the window
 * @param windowMs Window duration in milliseconds
 * @returns        { success, remaining } — success is false when the limit is exceeded
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number } {
  const now = Date.now();

  // Periodic housekeeping
  cleanup(now);

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the current window
  const windowStart = now - windowMs;
  entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

  if (entry.timestamps.length >= limit) {
    return { success: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { success: true, remaining: limit - entry.timestamps.length };
}

/**
 * Extract a rate-limit key from the incoming request.
 * Uses x-forwarded-for (first IP) or falls back to "unknown".
 */
export function getRateLimitKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be a comma-separated list; take the first (client) IP
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

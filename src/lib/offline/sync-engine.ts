import { cacheRecords, getSyncMeta, setSyncMeta, type StoreName } from "./db";

export interface SyncResult<T> {
  data: T[];
  fromCache: boolean;
  lastSynced: number | null;
}

/**
 * Stale-While-Revalidate pattern:
 * 1. Return cached data immediately (if available)
 * 2. Fetch fresh data in background
 * 3. Update cache and notify if data changed
 *
 * @param cacheKey - Unique key for this query (e.g. "projects:list" or "drawings:project-123")
 * @param storeName - IndexedDB store to cache into
 * @param fetchFn - Function that fetches fresh data from the network
 * @param getCachedFn - Function that reads cached data from IndexedDB
 * @param tenantId - Current tenant ID for cache isolation
 * @param maxAge - Max age in ms before background refresh (default: 60s)
 */
export async function staleWhileRevalidate<T extends Record<string, unknown>>(options: {
  cacheKey: string;
  storeName: StoreName;
  fetchFn: () => Promise<T[]>;
  getCachedFn: () => Promise<T[]>;
  tenantId: string;
  maxAge?: number;
  onFreshData?: (data: T[]) => void;
}): Promise<SyncResult<T>> {
  const { cacheKey, storeName, fetchFn, getCachedFn, tenantId, maxAge = 60_000, onFreshData } = options;

  // 1. Try to get cached data
  let cachedData: T[] = [];
  let lastSynced: number | null = null;

  try {
    cachedData = await getCachedFn();
    const meta = await getSyncMeta(cacheKey);
    lastSynced = meta?.lastSynced ?? null;
  } catch {
    // IndexedDB not available — proceed without cache
  }

  const hasCachedData = cachedData.length > 0;
  const isFresh = lastSynced !== null && Date.now() - lastSynced < maxAge;

  // 2. If cache is fresh enough, return it without fetching
  if (hasCachedData && isFresh) {
    return { data: cachedData, fromCache: true, lastSynced };
  }

  // 3. If we're offline, return cached data
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { data: cachedData, fromCache: true, lastSynced };
  }

  // 4. Fetch fresh data (in background if we have cache, blocking if not)
  if (hasCachedData) {
    // Return stale data immediately, revalidate in background
    revalidateInBackground(cacheKey, storeName, fetchFn, tenantId, onFreshData);
    return { data: cachedData, fromCache: true, lastSynced };
  }

  // No cached data — must wait for network
  try {
    const freshData = await fetchFn();
    await cacheRecords(storeName, freshData as Record<string, unknown>[], tenantId);
    await setSyncMeta({ key: cacheKey, lastSynced: Date.now(), tenantId });
    return { data: freshData, fromCache: false, lastSynced: Date.now() };
  } catch {
    // Network failed and no cache — return empty
    return { data: [], fromCache: false, lastSynced: null };
  }
}

async function revalidateInBackground<T extends Record<string, unknown>>(
  cacheKey: string,
  storeName: StoreName,
  fetchFn: () => Promise<T[]>,
  tenantId: string,
  onFreshData?: (data: T[]) => void
): Promise<void> {
  try {
    const freshData = await fetchFn();
    await cacheRecords(storeName, freshData as Record<string, unknown>[], tenantId);
    await setSyncMeta({ key: cacheKey, lastSynced: Date.now(), tenantId });
    onFreshData?.(freshData);
  } catch {
    // Background revalidation failed silently — cached data stays
  }
}

/** Format a timestamp as relative time string */
export function formatLastSynced(timestamp: number | null, locale: string = "de"): string {
  if (!timestamp) return locale === "de" ? "Nie synchronisiert" : "Never synced";

  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (seconds < 60) {
    return locale === "de" ? "Gerade eben" : "Just now";
  }
  if (minutes < 60) {
    return locale === "de"
      ? `Vor ${minutes} Min.`
      : `${minutes} min ago`;
  }
  if (hours < 24) {
    return locale === "de"
      ? `Vor ${hours} Std.`
      : `${hours}h ago`;
  }

  const date = new Date(timestamp);
  return date.toLocaleString(locale === "de" ? "de-DE" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const PDF_CACHE_NAME = "link2plan-pdfs";

/** Request persistent storage once so the browser won't evict cached PDFs
 *  under storage pressure. Best-effort; not supported everywhere. */
let persistRequested = false;
async function ensurePersistentStorage(): Promise<void> {
  if (persistRequested) return;
  persistRequested = true;
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
      await navigator.storage.persist();
    }
  } catch {
    // Storage Manager not available — ignore
  }
}

/** Cheap byte size of a cached response via Content-Length (no blob read). */
function responseSize(res: Response): number {
  const len = res.headers.get("content-length");
  const n = len ? parseInt(len, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** Evict oldest entries (the Cache API preserves insertion order) until at
 *  least `bytesNeeded` has been freed or the cache is empty. */
async function evictOldest(cache: Cache, bytesNeeded: number): Promise<void> {
  const keys = await cache.keys();
  let freed = 0;
  for (const req of keys) {
    if (freed >= bytesNeeded) break;
    const res = await cache.match(req);
    freed += res ? responseSize(res) : 0;
    await cache.delete(req);
  }
}

/** Normalize a Supabase storage URL to a stable cache key (strip token params) */
function toCacheKey(url: string): string {
  try {
    const parsed = new URL(url);
    // Remove auth token and expiry params so the same file always has the same key
    parsed.searchParams.delete("token");
    parsed.searchParams.delete("t");
    return parsed.toString();
  } catch {
    return url;
  }
}

/** Check if a PDF is already in the cache */
export async function isPdfCached(url: string): Promise<boolean> {
  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    const match = await cache.match(toCacheKey(url));
    return !!match;
  } catch {
    return false;
  }
}

/** Cache a PDF response (call after fetching). On a storage-quota rejection,
 *  evict the oldest cached PDFs and retry once instead of silently dropping it. */
export async function cachePdf(url: string, response: Response): Promise<void> {
  await ensurePersistentStorage();
  const key = toCacheKey(url);
  const size = responseSize(response);
  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    try {
      await cache.put(key, response.clone());
    } catch (err) {
      // Likely QuotaExceededError — free room (at least this file, min 50 MB)
      // by dropping the oldest entries, then retry once.
      await evictOldest(cache, Math.max(size, 50 * 1024 * 1024));
      try {
        await cache.put(key, response.clone());
      } catch {
        console.warn("[pdf-cache] PDF not cached — storage quota reached", err);
      }
    }
  } catch (err) {
    console.warn("[pdf-cache] cache unavailable", err);
  }
}

/** Get a cached PDF as a blob URL */
export async function getCachedPdf(url: string): Promise<string | null> {
  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    const response = await cache.match(toCacheKey(url));
    if (!response) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/**
 * Fetch a PDF with cache-first strategy.
 * Returns a blob URL for use in the PDF viewer.
 */
export async function fetchPdfWithCache(signedUrl: string): Promise<string> {
  // 1. Try cache first
  const cached = await getCachedPdf(signedUrl);
  if (cached) return cached;

  // 2. Fetch from network
  const response = await fetch(signedUrl);
  if (!response.ok) {
    throw new Error(`PDF fetch failed: ${response.status}`);
  }

  // 3. Cache the response
  await cachePdf(signedUrl, response.clone());

  // 4. Return blob URL
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/** Delete a specific PDF from cache */
export async function deleteCachedPdf(url: string): Promise<boolean> {
  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    return await cache.delete(toCacheKey(url));
  } catch {
    return false;
  }
}

/** Clear all cached PDFs */
export async function clearPdfCache(): Promise<void> {
  try {
    await caches.delete(PDF_CACHE_NAME);
  } catch {
    // Ignore
  }
}

/**
 * Find a cached PDF by storage path (e.g. "{projectId}/{drawingId}/1.pdf").
 * Searches all cache entries for a URL containing this path.
 * Used for offline access when we can't get a signed URL.
 */
export async function getCachedPdfByStoragePath(storagePath: string): Promise<string | null> {
  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    const keys = await cache.keys();

    // Encode the storage path the same way it appears in URLs
    const encodedPath = encodeURIComponent(storagePath).replace(/%2F/g, "/");

    for (const request of keys) {
      const url = typeof request === "string" ? request : request.url;
      if (url.includes(storagePath) || url.includes(encodedPath)) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          return URL.createObjectURL(blob);
        }
      }
    }

    // Fallback: try matching just the filename part (last segment)
    const filename = storagePath.split("/").pop();
    if (filename && keys.length > 0) {
      for (const request of keys) {
        const url = typeof request === "string" ? request : request.url;
        if (url.includes(filename)) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            return URL.createObjectURL(blob);
          }
        }
      }
    }
  } catch {
    // Cache not available
  }
  return null;
}

/** Count cached PDFs and total size */
export async function getPdfCacheStats(): Promise<{
  count: number;
  totalSize: number;
}> {
  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    const keys = await cache.keys();
    let totalSize = 0;

    // Sum Content-Length headers rather than materializing every PDF blob into
    // memory (which could be hundreds of MB and spike GC).
    for (const request of keys) {
      const response = await cache.match(request);
      if (response) totalSize += responseSize(response);
    }

    return { count: keys.length, totalSize };
  } catch {
    return { count: 0, totalSize: 0 };
  }
}

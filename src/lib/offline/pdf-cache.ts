const PDF_CACHE_NAME = "link2plan-pdfs";

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

/** Cache a PDF response (call after fetching) */
export async function cachePdf(url: string, response: Response): Promise<void> {
  try {
    const cache = await caches.open(PDF_CACHE_NAME);
    await cache.put(toCacheKey(url), response.clone());
  } catch {
    // Silently fail — cache might be full
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
    for (const request of keys) {
      if (request.url.includes(storagePath)) {
        const response = await cache.match(request);
        if (response) {
          const blob = await response.blob();
          return URL.createObjectURL(blob);
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

    for (const request of keys) {
      const response = await cache.match(request);
      if (response) {
        const blob = await response.clone().blob();
        totalSize += blob.size;
      }
    }

    return { count: keys.length, totalSize };
  } catch {
    return { count: 0, totalSize: 0 };
  }
}

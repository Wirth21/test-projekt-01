const CACHE_NAME = "link2plan-v2";
const PDF_CACHE_NAME = "link2plan-pdfs";
const OFFLINE_URL = "/offline.html";

// Precache critical assets on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png"])
    )
  );
  self.skipWaiting();
});

// Clean old caches on activate (keep PDF cache)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== PDF_CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  clients.claim();
});

/**
 * Check if a URL is a Supabase Storage PDF request.
 * These URLs contain /storage/v1/object/ and end with .pdf or have content-type hints.
 */
function isSupabasePdfRequest(url) {
  return url.includes("/storage/v1/object/") && (url.includes(".pdf") || url.includes("pdf"));
}

/**
 * Normalize a Supabase storage URL to a stable cache key (strip token params).
 */
function toPdfCacheKey(url) {
  try {
    const parsed = new URL(url);
    parsed.searchParams.delete("token");
    parsed.searchParams.delete("t");
    return parsed.toString();
  } catch {
    return url;
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // PDF requests: cache-first strategy
  if (isSupabasePdfRequest(event.request.url)) {
    event.respondWith(
      caches.open(PDF_CACHE_NAME).then((cache) => {
        const cacheKey = toPdfCacheKey(event.request.url);
        return cache.match(cacheKey).then((cached) => {
          if (cached) return cached;

          return fetch(event.request).then((response) => {
            if (response.ok) {
              // Store with normalized key
              cache.put(cacheKey, response.clone());
            }
            return response;
          }).catch(() => {
            // PDF not cached and offline
            return new Response("PDF nicht offline verfügbar", {
              status: 503,
              statusText: "Service Unavailable",
            });
          });
        });
      })
    );
    return;
  }

  // Navigation requests: network-first with offline fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // Other requests: network-first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && event.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

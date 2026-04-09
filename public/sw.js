const CACHE_NAME = "link2plan-v3";
const PDF_CACHE_NAME = "link2plan-pdfs";
const APP_SHELL_CACHE = "link2plan-app-shell";
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

// Clean old caches on activate (keep PDF cache + app shell)
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== PDF_CACHE_NAME && key !== APP_SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  clients.claim();
});

/**
 * Check if a URL is a Supabase Storage PDF request.
 */
function isSupabasePdfRequest(url) {
  return url.includes("/storage/v1/object/") && (url.includes(".pdf") || url.includes("pdf"));
}

/**
 * Check if a URL is a Next.js static asset (_next/static/).
 * These are immutable (content-hashed) and safe to cache forever.
 */
function isNextStaticAsset(url) {
  return url.includes("/_next/static/");
}

/**
 * Check if a URL is a Next.js data/page request (_next/data/ or page RSC).
 */
function isNextPageRequest(url) {
  return url.includes("/_next/data/") || url.includes("?_rsc=");
}

/**
 * Check if a URL is an API request.
 */
function isApiRequest(url) {
  return url.includes("/api/");
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

  const url = event.request.url;

  // 1. PDF requests: cache-first strategy
  if (isSupabasePdfRequest(url)) {
    event.respondWith(
      caches.open(PDF_CACHE_NAME).then((cache) => {
        const cacheKey = toPdfCacheKey(url);
        return cache.match(cacheKey).then((cached) => {
          if (cached) return cached;

          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(cacheKey, response.clone());
            }
            return response;
          }).catch(() => {
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

  // 2. Next.js static assets (_next/static/): cache-first (immutable, content-hashed)
  if (isNextStaticAsset(url)) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;

          return fetch(event.request).then((response) => {
            if (response.ok) {
              cache.put(event.request, response.clone());
            }
            return response;
          }).catch(() => new Response("", { status: 503 }));
        })
      )
    );
    return;
  }

  // 3. API requests: network-first, cache fallback (for offline data access)
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) =>
          cached || new Response(JSON.stringify({ error: "Offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          })
        ))
    );
    return;
  }

  // 4. Navigation requests: network-first, serve cached page or offline.html
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful navigation responses for offline use
          if (response.ok) {
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => {
              cache.put(event.request, clone);
            });
          }
          return response;
        })
        .catch(() =>
          // Try to serve the cached version of this exact page
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Try the dashboard as fallback (SPA-like navigation)
            return caches.match("/dashboard").then((dashboard) => {
              if (dashboard) return dashboard;
              return caches.match(OFFLINE_URL);
            });
          })
        )
    );
    return;
  }

  // 5. Everything else (fonts, images, etc.): network-first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.startsWith(self.location.origin)) {
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

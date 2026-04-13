const CACHE_NAME = "link2plan-v4";
const PDF_CACHE_NAME = "link2plan-pdfs";
const APP_SHELL_CACHE = "link2plan-app-v2";
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

// Clean old caches on activate (keep PDF cache + current app shell)
self.addEventListener("activate", (event) => {
  const keepCaches = [CACHE_NAME, PDF_CACHE_NAME, APP_SHELL_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !keepCaches.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  clients.claim();
});

function isSupabasePdfRequest(url) {
  return url.includes("/storage/v1/object/") && (url.includes(".pdf") || url.includes("pdf"));
}

function isNextStaticAsset(url) {
  return url.includes("/_next/static/");
}

function isApiRequest(url) {
  return url.includes("/api/");
}

function isDashboardRoute(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/dashboard");
  } catch {
    return false;
  }
}

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

  // 1. PDF requests: cache-first
  if (isSupabasePdfRequest(url)) {
    event.respondWith(
      caches.open(PDF_CACHE_NAME).then((cache) => {
        const cacheKey = toPdfCacheKey(url);
        return cache.match(cacheKey).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(cacheKey, response.clone());
            return response;
          }).catch(() =>
            new Response("PDF nicht offline verfügbar", { status: 503 })
          );
        });
      })
    );
    return;
  }

  // 2. Next.js static assets: cache-first (immutable, content-hashed)
  if (isNextStaticAsset(url)) {
    event.respondWith(
      caches.open(APP_SHELL_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          }).catch(() => new Response("", { status: 503 }));
        })
      )
    );
    return;
  }

  // 3. API requests: network-first, cache fallback
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) =>
            cached || new Response(JSON.stringify({ error: "Offline" }), {
              status: 503,
              headers: { "Content-Type": "application/json" },
            })
          )
        )
    );
    return;
  }

  // 4. Dashboard navigation: network-first, then exact cache, then /dashboard shell
  if (event.request.mode === "navigate" && isDashboardRoute(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          // 1. Try exact URL match
          caches.match(event.request).then((exact) => {
            if (exact) return exact;
            // 2. Use /dashboard as app shell — React Router handles the rest client-side
            return caches.match("/dashboard").then((shell) => {
              if (shell) return shell;
              return caches.match(OFFLINE_URL);
            });
          })
        )
    );
    return;
  }

  // 5. Other navigation (login, etc.): network-first, cache fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) =>
            cached || caches.match(OFFLINE_URL)
          )
        )
    );
    return;
  }

  // 6. Everything else: network-first, cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// Listen for messages from the app (e.g., prefetch requests)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "PREFETCH_ROUTES") {
    const urls = event.data.urls || [];
    event.waitUntil(
      caches.open(APP_SHELL_CACHE).then(async (cache) => {
        for (const url of urls) {
          try {
            // Only fetch if not already cached
            const existing = await cache.match(url);
            if (!existing) {
              const response = await fetch(url, { credentials: "include" });
              if (response.ok) {
                await cache.put(url, response);
              }
            }
          } catch {
            // Skip failed prefetches
          }
        }
      })
    );
  }
});

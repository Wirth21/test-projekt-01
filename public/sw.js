const CACHE_NAME = "link2plan-v5";
const PDF_CACHE_NAME = "link2plan-pdfs";
const APP_SHELL_CACHE = "link2plan-app-v4";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png"])
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keepCaches = [CACHE_NAME, PDF_CACHE_NAME, APP_SHELL_CACHE];
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => !keepCaches.includes(key)).map((key) => caches.delete(key))
      )
    )
  );
  clients.claim();
});

function isSupabasePdfRequest(url) {
  return url.includes("/storage/v1/object/") && url.includes("pdf");
}

function isNextStaticAsset(url) {
  return url.includes("/_next/static/");
}

function isApiRequest(url) {
  return url.includes("/api/");
}

function isDashboardRoute(url) {
  try { return new URL(url).pathname.startsWith("/dashboard"); }
  catch { return false; }
}

function getPathname(url) {
  try { return new URL(url).pathname; }
  catch { return url; }
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

/**
 * Try to find a cached response for a given pathname.
 * Searches across all entries in the cache for a matching pathname,
 * regardless of whether it was stored with relative or absolute URL.
 */
async function findCachedPage(cache, targetPathname) {
  // 1. Try direct match with pathname
  const byPath = await cache.match(targetPathname);
  if (byPath) return byPath;

  // 2. Try full URL match
  const fullUrl = new URL(targetPathname, self.location.origin).toString();
  const byFull = await cache.match(fullUrl);
  if (byFull) return byFull;

  // 3. Scan all cache keys for pathname match
  const keys = await cache.keys();
  for (const request of keys) {
    const cachedPath = getPathname(typeof request === "string" ? request : request.url);
    if (cachedPath === targetPathname) {
      return cache.match(request);
    }
  }

  return null;
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

  // 2. Next.js static assets: cache-first (immutable)
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

  // 3. API requests: pass through to network (React Query handles caching)
  if (isApiRequest(url)) {
    return;
  }

  // 4. RSC requests (Next.js client-side nav): network-first, redirect to full nav on failure
  const isRscRequest = event.request.headers.get("RSC") === "1"
    || event.request.headers.get("Next-Router-State-Tree")
    || url.includes("_rsc=");

  if (isRscRequest && isDashboardRoute(url)) {
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
          caches.match(event.request).then((cached) => {
            if (cached) return cached;
            // Redirect to full page load — the navigation handler will serve cached HTML
            try {
              const parsed = new URL(url);
              parsed.searchParams.delete("_rsc");
              return Response.redirect(parsed.toString(), 302);
            } catch {
              return Response.redirect(url, 302);
            }
          })
        )
    );
    return;
  }

  // 5. Dashboard navigation: network-first, then smart cache lookup
  if (event.request.mode === "navigate" && isDashboardRoute(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            // Cache with both the request AND the pathname for reliable offline matching
            const pathname = getPathname(url);
            const clone1 = response.clone();
            const clone2 = response.clone();
            caches.open(APP_SHELL_CACHE).then((c) => {
              c.put(event.request, clone1);
              // Also store by pathname for prefetch compatibility
              c.put(pathname, clone2);
            });
          }
          return response;
        })
        .catch(async () => {
          const cache = await caches.open(APP_SHELL_CACHE);
          const pathname = getPathname(url);

          // 1. Smart cache lookup (handles both relative and absolute URLs)
          const cached = await findCachedPage(cache, pathname);
          if (cached) return cached;

          // 2. Last resort: offline page
          const offline = await caches.match(OFFLINE_URL);
          return offline || new Response("Offline", { status: 503 });
        })
    );
    return;
  }

  // 6. Other navigation: network-first, cache fallback
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

  // 7. Everything else: network-first, cache fallback
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


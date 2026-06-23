const CACHE_NAME = "link2plan-v10";
const PDF_CACHE_NAME = "link2plan-pdfs";
// Drawing thumbnails (Supabase Storage *.thumb.jpg). Kept separate from the
// app shell so a shell-cache bump never evicts the (large) thumbnail set.
const THUMB_CACHE_NAME = "link2plan-thumbs";
// v8: adds best-effort pre-cache of "/" and "/login" on install, and the
// server-error fallback page now ships a one-tap self-heal button that
// unregisters the SW and purges caches. Old v7 entries are dropped on
// activate via the keepCaches filter.
const APP_SHELL_CACHE = "link2plan-app-v8";
const OFFLINE_URL = "/offline.html";

// Minimal HTML returned when the user is online but the server replied
// with 5xx or the fetch threw (e.g. Vercel cold-start timeout, edge
// reset). NEVER serve offline.html in this case — it would tell the
// user they have no internet, which is false.
//
// The page ships a "Cache leeren und neu laden" button so a user whose
// SW state is somehow corrupted can recover without a PC or Chrome's
// site-data menu. This is the only escape hatch for a wedged WebAPK.
function makeServerErrorResponse(status) {
  const body = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kurz nicht erreichbar</title><style>body{font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;color:#111;text-align:center}h1{font-size:22px;margin-bottom:8px}p{color:#555;margin:8px 0}.actions{margin-top:20px;display:flex;flex-direction:column;gap:10px}button{padding:11px 20px;font-size:15px;border:none;border-radius:8px;cursor:pointer}.primary{background:#3b82f6;color:#fff}.primary:hover{background:#2563eb}.secondary{background:transparent;color:#3b82f6;border:1px solid #3b82f6}.secondary:hover{background:#eff6ff}.hint{font-size:12px;color:#888;margin-top:14px}</style></head><body><h1>Server kurz nicht erreichbar</h1><p>Bitte versuche es in einem Moment erneut. Deine Internetverbindung ist in Ordnung.</p><div class="actions"><button class="primary" onclick="window.location.reload()">Erneut versuchen</button><button class="secondary" onclick="resetApp()">Cache leeren und neu laden</button></div><p class="hint">Wenn "Erneut versuchen" auch nach mehreren Anlaeufen scheitert, hilft "Cache leeren".</p><script>async function resetApp(){try{if('serviceWorker' in navigator){var r=await navigator.serviceWorker.getRegistrations();await Promise.all(r.map(function(x){return x.unregister();}));}if('caches' in self){var k=await caches.keys();await Promise.all(k.map(function(x){return caches.delete(x);}));}}catch(e){}window.location.reload();}</script></body></html>`;
  return new Response(body, {
    status: status || 503,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll([OFFLINE_URL, "/icon-192.png", "/icon-512.png"]);
      // Best-effort pre-cache of the public landing + login pages.
      // Gives PWA cold-start a fallback even if Vercel hiccups on the
      // very first navigation. Failures are swallowed on purpose —
      // this is a safety net, not a hard requirement.
      const shell = await caches.open(APP_SHELL_CACHE);
      await Promise.all(
        ["/", "/login"].map(async (path) => {
          try {
            const res = await fetch(path);
            if (res.ok && !res.redirected) {
              await shell.put(path, res.clone());
            }
          } catch {}
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const keepCaches = [CACHE_NAME, PDF_CACHE_NAME, APP_SHELL_CACHE, THUMB_CACHE_NAME];
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

// Server-rendered drawing thumbnails sit next to the PDF as *.thumb.jpg.
// Matched BEFORE the PDF branch in the fetch handler so the two never overlap.
function isSupabaseThumbnailRequest(url) {
  return url.includes("/storage/v1/object/") && url.includes(".thumb.jpg");
}

// The pdfjs render worker, copied to /public by the postinstall script and
// loaded by the drawing viewer + thumbnail renderer.
function isPdfWorkerRequest(url) {
  try { return new URL(url).pathname === "/pdfjs-worker.min.mjs"; }
  catch { return false; }
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

// Stale-while-revalidate: serve the cached copy instantly and refresh it in the
// background. Used for thumbnails and the pdfjs worker — both can change in
// place (a thumbnail re-bake reuses the same storage path; a pdfjs upgrade
// ships under the same /pdfjs-worker.min.mjs filename), so a pure immutable
// cache-first would pin stale bytes forever. Only `ok` responses are cached;
// the thumbnail <img> elements set crossOrigin="anonymous" so the SW sees real
// CORS status codes — an expired-token 403 is therefore never stored, and a
// re-baked/upgraded asset self-heals on the very next load.
function staleWhileRevalidate(event, cacheName, cacheKey) {
  return caches.open(cacheName).then(async (cache) => {
    const cached = await cache.match(cacheKey);
    const network = fetch(event.request)
      .then((response) => {
        if (response.ok) cache.put(cacheKey, response.clone());
        return response;
      })
      .catch(() => null);
    if (cached) {
      // Hit: return immediately, let the refresh finish in the background.
      event.waitUntil(network.then(() => {}));
      return cached;
    }
    const fresh = await network;
    return fresh || new Response("", { status: 503 });
  });
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

  // 3. Scan all cache keys for pathname match.
  //    CAREFUL: Next.js caches RSC flight payloads under URLs like
  //    `/foo?_rsc=abc`, whose pathname matches the HTML route. Serving that
  //    RSC body as a top-level navigation response makes the browser render
  //    the raw flight protocol as plain text. Skip those entries here.
  const keys = await cache.keys();
  for (const request of keys) {
    const reqUrl = typeof request === "string" ? request : request.url;
    if (reqUrl.includes("_rsc=")) continue;
    const cachedPath = getPathname(reqUrl);
    if (cachedPath === targetPathname) {
      return cache.match(request);
    }
  }

  return null;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = event.request.url;

  // 0a. pdfjs worker: stale-while-revalidate. A big module loaded by the
  //     drawing viewer + thumbnail renderer; serving it from disk removes a
  //     network wait on every viewer open. Refresh in the background so a
  //     pdfjs upgrade (same filename) is picked up on the next load.
  if (isPdfWorkerRequest(url)) {
    event.respondWith(staleWhileRevalidate(event, APP_SHELL_CACHE, url));
    return;
  }

  // 0b. Supabase thumbnails: stale-while-revalidate with a token-stripped key
  //     so a re-signed URL hits the same entry (rotating ?token otherwise
  //     defeats every cache). Must run BEFORE the PDF branch below.
  if (isSupabaseThumbnailRequest(url)) {
    event.respondWith(staleWhileRevalidate(event, THUMB_CACHE_NAME, toPdfCacheKey(url)));
    return;
  }

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
        .then(async (response) => {
          if (response.ok) {
            // Don't cache redirected bodies under the original key — they
            // belong to a different URL and would poison subsequent loads
            // (e.g. /login flight payload stored under /dashboard).
            if (!response.redirected) {
              const clone = response.clone();
              caches.open(APP_SHELL_CACHE).then((c) => c.put(event.request, clone));
            }
            return response;
          }
          // Non-ok (502/503/504 from edge): try cached RSC, else redirect to full nav
          const cached = await caches.match(event.request);
          if (cached) return cached;
          try {
            const parsed = new URL(url);
            parsed.searchParams.delete("_rsc");
            return Response.redirect(parsed.toString(), 302);
          } catch {
            return response;
          }
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

  // 5. Dashboard navigation: network-first, cache ONLY on ok.
  //    On non-ok response: try stale cache, else — crucially — DO NOT
  //    serve offline.html if the user is online (would falsely claim
  //    "no internet"). Serve a server-error page instead. Only show
  //    offline.html when navigator.onLine === false.
  if (event.request.mode === "navigate" && isDashboardRoute(url)) {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            // Skip caching when fetch followed a redirect: the body is the
            // destination page (often /login during a cookie-less PWA cold
            // start), not the requested route. Caching it under /dashboard
            // would serve the stale /login HTML on every subsequent open.
            if (response.redirected) return response;
            const pathname = getPathname(url);
            const clone1 = response.clone();
            const clone2 = response.clone();
            caches.open(APP_SHELL_CACHE).then((c) => {
              c.put(event.request, clone1);
              c.put(pathname, clone2);
            });
            return response;
          }
          // Non-ok (e.g. 504 from Vercel edge): try stale cache first.
          const cache = await caches.open(APP_SHELL_CACHE);
          const pathname = getPathname(url);
          const cached = await findCachedPage(cache, pathname);
          if (cached) return cached;
          // No cache. User got a real server response — they are online.
          // Show a server-error page (retry button) instead of misleading
          // "you are offline" screen.
          if (self.navigator && self.navigator.onLine === false) {
            const offline = await caches.match(OFFLINE_URL);
            if (offline) return offline;
          }
          return makeServerErrorResponse(response.status);
        })
        .catch(async () => {
          const cache = await caches.open(APP_SHELL_CACHE);
          const pathname = getPathname(url);
          const cached = await findCachedPage(cache, pathname);
          if (cached) return cached;
          // Fetch threw. Differentiate truly offline vs. transient.
          if (self.navigator && self.navigator.onLine === false) {
            const offline = await caches.match(OFFLINE_URL);
            return offline || new Response("Offline", { status: 503 });
          }
          return makeServerErrorResponse(503);
        })
    );
    return;
  }

  // 6. Other navigation: network-first, cache fallback on 5xx or network error
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            // Same redirect-poisoning concern as branch #5 — skip caching.
            if (response.redirected) return response;
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((c) => c.put(event.request, clone));
            return response;
          }
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (self.navigator && self.navigator.onLine === false) {
            const offline = await caches.match(OFFLINE_URL);
            if (offline) return offline;
          }
          return makeServerErrorResponse(response.status);
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          if (self.navigator && self.navigator.onLine === false) {
            const offline = await caches.match(OFFLINE_URL);
            return offline || new Response("Offline", { status: 503 });
          }
          return makeServerErrorResponse(503);
        })
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


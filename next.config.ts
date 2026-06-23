import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";


const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data: https:",
      "font-src 'self'",
      "connect-src 'self' blob: https://*.supabase.co wss://*.supabase.co https://*.ingest.de.sentry.io",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // Exposed to the client and used as the React Query persistence `buster`:
  // a new deploy => new commit SHA => the 24h IndexedDB cache from the
  // previous build is discarded on restore. Prevents serving a stale-shaped
  // cache blob after a data-model change (the "Ghost-Data" failure class).
  // Falls back to "dev" outside Vercel (local/CI builds), where busting per
  // build is unnecessary.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev",
  },
  // Client-side router cache. Next 15/16 default `dynamic` to 0s, which means
  // navigating BACK to an already-visited dynamic route (e.g. from a drawing
  // back to the project overview) re-fetches that route's RSC payload from the
  // server every time — slow, even though the data is already in React Query.
  //
  // Window deliberately large (30 min): if it were short, idling a few minutes
  // in a drawing and then going back would expire the entry, forcing a server
  // round-trip — which simply FAILS offline. With a long window the back-nav is
  // served from the in-memory router cache (instant, no network) across realistic
  // idle periods. Data freshness is owned by React Query (staleTime + project
  // change-signature), not the route shell, so a long window is safe.
  //
  // Note: this in-memory cache only covers a live session. True cross-session
  // offline (reopened PWA, no network) is handled by the service worker, which
  // serves cached route HTML, plus React Query's 30-day IndexedDB persistence.
  experimental: {
    staleTimes: {
      dynamic: 1800, // 30 min
      static: 1800,
    },
  },
  transpilePackages: ["react-pdf", "pdfjs-dist"],
  turbopack: {
    resolveAlias: {
      // canvas is not available in the browser (needed for pdfjs-dist)
      canvas: { browser: "" },
    },
  },
  webpack: (config) => {
    // Alias for canvas (not available in browser)
    config.resolve.alias.canvas = false;
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);

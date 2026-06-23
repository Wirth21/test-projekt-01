import { QueryClient } from "@tanstack/react-query";

// Single source of truth for the on-device cache lifetime. The persister's
// maxAge (see QueryProvider) MUST be <= gcTime, otherwise React Query evicts a
// query from memory before the persisted copy is allowed to be restored, and
// the cache silently does nothing. Keep gcTime === CACHE_MAX_AGE_MS and derive
// the persister maxAge from the same constant so the two can never drift apart.
//
// 30 days (was 24h): metadata changes rarely, and stale data is now caught two
// ways — the deploy `buster` (next.config build id) drops the cache on every
// release, and the per-project change signature refetches when server data
// actually moved. So a long offline-retention window is safe and lets the app
// open instantly from cache even after days without a connection.
export const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60_000; // 30 days

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Most lists in this app (drawings, projects, groups) change rarely
        // during a session. Five minutes of "fresh" cuts way more disk IO
        // on the Supabase Free plan than the previous 30 s default. Hooks
        // that need lower latency (admin lists) override locally.
        staleTime: 5 * 60_000,
        gcTime: CACHE_MAX_AGE_MS, // must stay >= persister maxAge
        // Refetch on focus made every tab-switch hammer the API. We
        // explicitly invalidate after mutations, so this is unnecessary
        // and was the single biggest source of disk-IO spikes.
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Most lists in this app (drawings, projects, groups) change rarely
        // during a session. Five minutes of "fresh" cuts way more disk IO
        // on the Supabase Free plan than the previous 30 s default. Hooks
        // that need lower latency (admin lists) override locally.
        staleTime: 5 * 60_000,
        gcTime: 24 * 60 * 60_000, // 24h — must be >= persister maxAge
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

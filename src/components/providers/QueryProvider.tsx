"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient, CACHE_MAX_AGE_MS } from "@/lib/query-client";
import { queryPersister } from "@/lib/query-persister";
import type { ReactNode } from "react";

// One-time cleanup of legacy IndexedDB cache (replaced by React Query)
if (typeof window !== "undefined") {
  try { indexedDB.deleteDatabase("link2plan-cache"); } catch { /* ignore */ }
}

// Bumps with every deploy (commit SHA, see next.config.ts). When it changes,
// PersistQueryClientProvider throws away the previously persisted cache on
// restore instead of rehydrating a blob whose shape may no longer match the
// new code. "dev" outside Vercel — the cache simply survives across local runs.
const PERSIST_BUSTER = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        // Derived from the same constant as gcTime so maxAge <= gcTime always
        // holds (otherwise queries are evicted before they can be restored).
        maxAge: CACHE_MAX_AGE_MS,
        buster: PERSIST_BUSTER,
        dehydrateOptions: {
          // Only persist completed, non-empty results. Errors and pending
          // queries are skipped so a transient failure never gets frozen into
          // the on-device cache and re-served on the next cold start.
          shouldDehydrateQuery: (query) =>
            query.state.status === "success" && query.state.data != null,
        },
      }}
    >
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  );
}

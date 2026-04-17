"use client";

import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { getQueryClient } from "@/lib/query-client";
import { queryPersister } from "@/lib/query-persister";
import type { ReactNode } from "react";

// One-time cleanup of legacy IndexedDB cache (replaced by React Query)
if (typeof window !== "undefined") {
  try { indexedDB.deleteDatabase("link2plan-cache"); } catch { /* ignore */ }
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: queryPersister,
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
      }}
    >
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </PersistQueryClientProvider>
  );
}

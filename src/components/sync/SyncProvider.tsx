"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";

export type SyncState = "synced" | "syncing" | "stale" | "offline";

interface SyncContextValue {
  state: SyncState;
  isOnline: boolean;
  lastSynced: number | null;
  tenantId: string | null;
  setTenantId: (id: string) => void;
  /** @deprecated No longer needed — React Query handles sync state. Kept for backward compat. */
  notifySynced: () => void;
  /** @deprecated No longer needed — React Query handles sync state. Kept for backward compat. */
  notifySyncing: () => void;
}

const SyncContext = createContext<SyncContextValue>({
  state: "stale",
  isOnline: true,
  lastSynced: null,
  tenantId: null,
  setTenantId: () => {},
  notifySynced: () => {},
  notifySyncing: () => {},
});

export function useSyncContext() {
  return useContext(SyncContext);
}

const STALE_THRESHOLD = 60_000;

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [tenantId, setTenantIdState] = useState<string | null>(null);
  const isFetching = useIsFetching();
  const queryClient = useQueryClient();

  // Auto-detect tenant ID from user profile
  useEffect(() => {
    async function detectTenant() {
      try {
        const { createClient } = await import("@/lib/supabase");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", user.id)
          .single();
        if (profile?.tenant_id) {
          setTenantIdState(profile.tenant_id);
          try { localStorage.setItem("link2plan_tenant_id", profile.tenant_id); } catch { /* ignore */ }
        }
      } catch { /* ignore */ }
    }

    try {
      const stored = localStorage.getItem("link2plan_tenant_id");
      if (stored) setTenantIdState(stored);
    } catch { /* ignore */ }

    detectTenant();
  }, []);

  // Online/offline detection
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Derive lastSynced from React Query's most recent dataUpdatedAt
  const lastSynced = useMemo(() => {
    const queries = queryClient.getQueryCache().getAll();
    const max = queries.reduce((m, q) => Math.max(m, q.state.dataUpdatedAt), 0);
    return max || null;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-derive when isFetching changes
  }, [queryClient, isFetching]);

  // Derive sync state
  let state: SyncState;
  if (!isOnline) {
    state = "offline";
  } else if (isFetching > 0) {
    state = "syncing";
  } else if (lastSynced && Date.now() - lastSynced < STALE_THRESHOLD) {
    state = "synced";
  } else {
    state = "stale";
  }

  const setTenantId = useCallback((id: string) => {
    setTenantIdState(id);
    try { localStorage.setItem("link2plan_tenant_id", id); } catch { /* ignore */ }
  }, []);

  // No-ops for backward compatibility (ProjectSyncButton still calls notifySynced)
  const notifySynced = useCallback(() => {}, []);
  const notifySyncing = useCallback(() => {}, []);

  return (
    <SyncContext.Provider
      value={{ state, isOnline, lastSynced, tenantId, setTenantId, notifySynced, notifySyncing }}
    >
      {children}
    </SyncContext.Provider>
  );
}

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
import { useUser } from "@/components/providers/UserProvider";

export type SyncState = "synced" | "syncing" | "stale" | "offline";

interface SyncContextValue {
  state: SyncState;
  isOnline: boolean;
  lastSynced: number | null;
  tenantId: string | null;
  /** @deprecated tenantId comes from UserProvider; retained for backward compat. */
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
  const { tenantId } = useUser();
  const [isOnline, setIsOnline] = useState(true);
  const isFetching = useIsFetching();
  const queryClient = useQueryClient();

  // Mirror tenantId into localStorage for offline fallback (e.g. when the
  // service worker serves a cached page without middleware having run).
  useEffect(() => {
    if (!tenantId) return;
    try { localStorage.setItem("link2plan_tenant_id", tenantId); } catch { /* ignore */ }
  }, [tenantId]);

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

  const setTenantId = useCallback((_id: string) => {
    // No-op: tenantId is now owned by UserProvider and cannot change mid-session.
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

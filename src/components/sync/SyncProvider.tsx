"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getSyncMeta } from "@/lib/offline/db";

export type SyncState = "synced" | "syncing" | "stale" | "offline";

interface SyncContextValue {
  /** Current sync state */
  state: SyncState;
  /** Whether the browser is online */
  isOnline: boolean;
  /** Timestamp of last successful sync (ms) */
  lastSynced: number | null;
  /** Current tenant ID */
  tenantId: string | null;
  /** Set tenant ID (called once on login) */
  setTenantId: (id: string) => void;
  /** Notify that a sync just completed */
  notifySynced: () => void;
  /** Notify that a sync is in progress */
  notifySyncing: () => void;
  /** Force a recalculation of sync state */
  refreshState: () => void;
}

const SyncContext = createContext<SyncContextValue>({
  state: "synced",
  isOnline: true,
  lastSynced: null,
  tenantId: null,
  setTenantId: () => {},
  notifySynced: () => {},
  notifySyncing: () => {},
  refreshState: () => {},
});

export function useSyncContext() {
  return useContext(SyncContext);
}

const STALE_THRESHOLD = 60_000; // 1 minute

export function SyncProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceUpdate] = useState(0);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load last sync time from IndexedDB on mount
  useEffect(() => {
    if (!tenantId) return;

    async function loadLastSynced() {
      try {
        const meta = await getSyncMeta(`global:${tenantId}`);
        if (meta) setLastSynced(meta.lastSynced);
      } catch {
        // Ignore
      }
    }

    loadLastSynced();
  }, [tenantId]);

  // Periodically re-evaluate staleness (every 30s)
  useEffect(() => {
    staleTimerRef.current = setInterval(() => {
      forceUpdate((n) => n + 1);
    }, 30_000);

    return () => {
      if (staleTimerRef.current) clearInterval(staleTimerRef.current);
    };
  }, []);

  const notifySynced = useCallback(() => {
    const now = Date.now();
    setLastSynced(now);
    setIsSyncing(false);
  }, []);

  const notifySyncing = useCallback(() => {
    setIsSyncing(true);
  }, []);

  const refreshState = useCallback(() => {
    forceUpdate((n) => n + 1);
  }, []);

  // Compute derived state
  let state: SyncState;
  if (!isOnline) {
    state = "offline";
  } else if (isSyncing) {
    state = "syncing";
  } else if (lastSynced && Date.now() - lastSynced < STALE_THRESHOLD) {
    state = "synced";
  } else {
    state = "stale";
  }

  return (
    <SyncContext.Provider
      value={{
        state,
        isOnline,
        lastSynced,
        tenantId,
        setTenantId,
        notifySynced,
        notifySyncing,
        refreshState,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

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

export type SyncState = "synced" | "syncing" | "stale" | "offline";

interface SyncContextValue {
  state: SyncState;
  isOnline: boolean;
  lastSynced: number | null;
  tenantId: string | null;
  setTenantId: (id: string) => void;
  notifySynced: () => void;
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
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tenantId, setTenantIdState] = useState<string | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [, forceUpdate] = useState(0);

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
          try { localStorage.setItem("link2plan_tenant_id", profile.tenant_id); } catch {}
        }
      } catch {}
    }

    // Try localStorage first for instant availability
    try {
      const stored = localStorage.getItem("link2plan_tenant_id");
      if (stored) setTenantIdState(stored);
    } catch {}

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

  // Restore lastSynced from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("link2plan_last_synced");
      if (stored) setLastSynced(Number(stored));
    } catch {}
  }, []);

  // Re-evaluate staleness periodically
  useEffect(() => {
    staleTimerRef.current = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => { if (staleTimerRef.current) clearInterval(staleTimerRef.current); };
  }, []);

  const notifySynced = useCallback(() => {
    const now = Date.now();
    setLastSynced(now);
    setIsSyncing(false);
    try { localStorage.setItem("link2plan_last_synced", String(now)); } catch {}
  }, []);

  const notifySyncing = useCallback(() => {
    setIsSyncing(true);
  }, []);

  const setTenantId = useCallback((id: string) => {
    setTenantIdState(id);
    try { localStorage.setItem("link2plan_tenant_id", id); } catch {}
  }, []);

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
      value={{ state, isOnline, lastSynced, tenantId, setTenantId, notifySynced, notifySyncing }}
    >
      {children}
    </SyncContext.Provider>
  );
}

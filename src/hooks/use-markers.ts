"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MarkerWithTarget } from "@/lib/types/marker";
import type { CreateMarkerInput, UpdateMarkerInput } from "@/lib/validations/marker";
import { cacheRecords, getCachedByIndex, getSyncMeta, setSyncMeta } from "@/lib/offline/db";
import { useSyncContext } from "@/components/sync/SyncProvider";

export function useMarkers(projectId: string, drawingId: string, versionId?: string) {
  const [markers, setMarkers] = useState<MarkerWithTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);
  const { notifySynced } = useSyncContext();

  const baseUrl = `/api/projects/${projectId}/drawings/${drawingId}/markers`;

  const fetchMarkers = useCallback(async () => {
    const cacheKey = `markers:${drawingId}:${versionId ?? "latest"}`;

    // Try cache first
    if (versionId) {
      try {
        const cached = await getCachedByIndex<MarkerWithTarget>("markers", "by-drawing-version", versionId);
        if (cached.length > 0) {
          setMarkers(cached);
          if (!initialLoadDone.current) setLoading(false);
          const meta = await getSyncMeta(cacheKey);
          if (meta && Date.now() - meta.lastSynced < 30_000) {
            initialLoadDone.current = true;
            return;
          }
        }
      } catch { /* IndexedDB not available */ }
    }

    if (typeof navigator !== "undefined" && !navigator.onLine && initialLoadDone.current) {
      setLoading(false);
      return;
    }

    // Only show loading spinner on initial load, not on refetch
    if (!initialLoadDone.current) {
      setLoading(true);
    }
    setError(null);

    try {
      const url = versionId ? `${baseUrl}?versionId=${versionId}` : baseUrl;
      const res = await fetch(url);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Marker konnten nicht geladen werden");
        return;
      }

      const freshMarkers = json.markers ?? [];
      setMarkers(freshMarkers);

      // Cache result
      try {
        await cacheRecords("markers", freshMarkers, projectId);
        await setSyncMeta({ key: cacheKey, lastSynced: Date.now(), tenantId: projectId });
      } catch { /* Cache write failed */ }
      notifySynced();
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten");
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [baseUrl, versionId, drawingId, projectId]);

  // Reset markers when drawingId changes to prevent stale data
  useEffect(() => {
    setMarkers([]);
    initialLoadDone.current = false;
    if (projectId && drawingId) {
      fetchMarkers();
    }
  }, [projectId, drawingId, fetchMarkers]);

  const createMarker = async (input: CreateMarkerInput): Promise<MarkerWithTarget> => {
    const url = versionId ? `${baseUrl}?versionId=${versionId}` : baseUrl;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Marker konnte nicht erstellt werden");
    }

    // Optimistic: add to local state immediately, then refetch in background
    const newMarker = json.marker as MarkerWithTarget;
    setMarkers((prev) => [...prev, newMarker]);
    fetchMarkers();
    return newMarker;
  };

  const updateMarker = async (
    markerId: string,
    input: UpdateMarkerInput
  ): Promise<MarkerWithTarget> => {
    // Optimistic: update local state immediately
    setMarkers((prev) =>
      prev.map((m) => (m.id === markerId ? { ...m, ...input } : m))
    );

    const res = await fetch(`${baseUrl}/${markerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const json = await res.json();
    if (!res.ok) {
      // Revert on error
      await fetchMarkers();
      throw new Error(json.error ?? "Marker konnte nicht aktualisiert werden");
    }

    // Sync with server state in background
    fetchMarkers();
    return json.marker;
  };

  const deleteMarker = async (markerId: string): Promise<void> => {
    // Optimistic: remove from local state immediately
    setMarkers((prev) => prev.filter((m) => m.id !== markerId));

    const res = await fetch(`${baseUrl}/${markerId}`, {
      method: "DELETE",
    });

    const json = await res.json();
    if (!res.ok) {
      await fetchMarkers();
      throw new Error(json.error ?? "Marker konnte nicht gelöscht werden");
    }

    // Sync in background
    fetchMarkers();
  };

  return {
    markers,
    loading,
    error,
    createMarker,
    updateMarker,
    deleteMarker,
    refetch: fetchMarkers,
  };
}

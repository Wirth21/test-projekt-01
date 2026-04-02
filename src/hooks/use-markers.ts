"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MarkerWithTarget } from "@/lib/types/marker";
import type { CreateMarkerInput, UpdateMarkerInput } from "@/lib/validations/marker";

export function useMarkers(projectId: string, drawingId: string, versionId?: string) {
  const [markers, setMarkers] = useState<MarkerWithTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialLoadDone = useRef(false);

  const baseUrl = `/api/projects/${projectId}/drawings/${drawingId}/markers`;

  const fetchMarkers = useCallback(async () => {
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

      setMarkers(json.markers ?? []);
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten");
    } finally {
      setLoading(false);
      initialLoadDone.current = true;
    }
  }, [baseUrl, versionId]);

  useEffect(() => {
    if (projectId && drawingId) {
      initialLoadDone.current = false;
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

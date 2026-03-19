"use client";

import { useCallback, useEffect, useState } from "react";
import type { MarkerWithTarget } from "@/lib/types/marker";
import type { CreateMarkerInput, UpdateMarkerInput } from "@/lib/validations/marker";

export function useMarkers(projectId: string, drawingId: string, versionId?: string) {
  const [markers, setMarkers] = useState<MarkerWithTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const baseUrl = `/api/projects/${projectId}/drawings/${drawingId}/markers`;

  const fetchMarkers = useCallback(async () => {
    setLoading(true);
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
    }
  }, [baseUrl, versionId]);

  useEffect(() => {
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

    await fetchMarkers();
    return json.marker;
  };

  const updateMarker = async (
    markerId: string,
    input: UpdateMarkerInput
  ): Promise<MarkerWithTarget> => {
    const res = await fetch(`${baseUrl}/${markerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Marker konnte nicht aktualisiert werden");
    }

    await fetchMarkers();
    return json.marker;
  };

  const deleteMarker = async (markerId: string): Promise<void> => {
    const res = await fetch(`${baseUrl}/${markerId}`, {
      method: "DELETE",
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Marker konnte nicht gelöscht werden");
    }

    await fetchMarkers();
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

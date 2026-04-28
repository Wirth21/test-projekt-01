"use client";

import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { MarkerWithTarget } from "@/lib/types/marker";
import type { CreateMarkerInput, UpdateMarkerInput } from "@/lib/validations/marker";

export function useMarkers(projectId: string, drawingId: string, versionId?: string) {
  const queryClient = useQueryClient();
  const baseUrl = `/api/projects/${projectId}/drawings/${drawingId}/markers`;
  const queryKey = useMemo(() => ["markers", projectId, drawingId, versionId ?? "latest"], [projectId, drawingId, versionId]);

  const { data, isLoading, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<MarkerWithTarget[]> => {
      const url = versionId ? `${baseUrl}?versionId=${versionId}` : baseUrl;
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Marker konnten nicht geladen werden");
      return json.markers ?? [];
    },
    staleTime: 5 * 60_000,
    enabled: !!projectId && !!drawingId,
  });

  const markers = data ?? [];

  const createMarker = useCallback(async (input: CreateMarkerInput): Promise<MarkerWithTarget> => {
    const url = versionId ? `${baseUrl}?versionId=${versionId}` : baseUrl;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Marker konnte nicht erstellt werden");

    const newMarker = json.marker as MarkerWithTarget;

    // Optimistic: add to cache immediately
    queryClient.setQueryData<MarkerWithTarget[]>(queryKey, (old) => [...(old ?? []), newMarker]);
    // Background sync
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["projects"] });

    return newMarker;
  }, [baseUrl, versionId, queryClient, queryKey]);

  const updateMarker = useCallback(async (
    markerId: string,
    input: UpdateMarkerInput
  ): Promise<MarkerWithTarget> => {
    // Optimistic: update cache immediately
    const previous = queryClient.getQueryData<MarkerWithTarget[]>(queryKey);
    queryClient.setQueryData<MarkerWithTarget[]>(queryKey, (old) =>
      (old ?? []).map((m) => (m.id === markerId ? { ...m, ...input } : m))
    );

    const res = await fetch(`${baseUrl}/${markerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const json = await res.json();
    if (!res.ok) {
      // Revert on error
      queryClient.setQueryData(queryKey, previous);
      throw new Error(json.error ?? "Marker konnte nicht aktualisiert werden");
    }

    // Background sync
    queryClient.invalidateQueries({ queryKey });
    return json.marker;
  }, [baseUrl, queryClient, queryKey]);

  const deleteMarker = useCallback(async (markerId: string): Promise<void> => {
    // Optimistic: remove from cache immediately
    const previous = queryClient.getQueryData<MarkerWithTarget[]>(queryKey);
    queryClient.setQueryData<MarkerWithTarget[]>(queryKey, (old) =>
      (old ?? []).filter((m) => m.id !== markerId)
    );

    const res = await fetch(`${baseUrl}/${markerId}`, { method: "DELETE" });
    const json = await res.json();

    if (!res.ok) {
      // Revert on error
      queryClient.setQueryData(queryKey, previous);
      throw new Error(json.error ?? "Marker konnte nicht gelöscht werden");
    }

    // Background sync
    queryClient.invalidateQueries({ queryKey });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [baseUrl, queryClient, queryKey]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return {
    markers,
    loading: isLoading,
    error: error?.message ?? null,
    createMarker,
    updateMarker,
    deleteMarker,
    refetch,
  };
}

"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { DrawingGroup } from "@/lib/types/drawing";

export function useDrawingGroups(projectId: string) {
  const queryClient = useQueryClient();

  const {
    data: groups = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery<DrawingGroup[]>({
    queryKey: ["drawing-groups", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/groups`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Gruppen konnten nicht geladen werden");
      }

      return json.groups ?? [];
    },
    staleTime: 30_000,
    enabled: !!projectId,
  });

  const error = queryError ? (queryError as Error).message : null;

  const createGroup = useCallback(
    async (name: string): Promise<DrawingGroup> => {
      const res = await fetch(`/api/projects/${projectId}/groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Gruppe konnte nicht erstellt werden");
      }

      await queryClient.invalidateQueries({ queryKey: ["drawing-groups", projectId] });
      return json.group;
    },
    [projectId, queryClient]
  );

  const renameGroup = useCallback(
    async (groupId: string, name: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/groups/${groupId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Umbenennung fehlgeschlagen");
      }

      await queryClient.invalidateQueries({ queryKey: ["drawing-groups", projectId] });
    },
    [projectId, queryClient]
  );

  const archiveGroup = useCallback(
    async (groupId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/groups/${groupId}/archive`,
        { method: "POST" }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Archivierung fehlgeschlagen");
      }

      await queryClient.invalidateQueries({ queryKey: ["drawing-groups", projectId] });
    },
    [projectId, queryClient]
  );

  const assignDrawingToGroup = useCallback(
    async (drawingId: string, groupId: string | null) => {
      const res = await fetch(
        `/api/projects/${projectId}/drawings/${drawingId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ group_id: groupId }),
        }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Gruppenzuweisung fehlgeschlagen");
      }

      await queryClient.invalidateQueries({ queryKey: ["drawings", projectId] });
    },
    [projectId, queryClient]
  );

  return {
    groups,
    loading,
    error,
    createGroup,
    renameGroup,
    archiveGroup,
    assignDrawingToGroup,
    refetch,
  };
}

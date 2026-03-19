"use client";

import { useCallback, useEffect, useState } from "react";
import type { DrawingGroup } from "@/lib/types/drawing";

export function useDrawingGroups(projectId: string) {
  const [groups, setGroups] = useState<DrawingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/groups`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Gruppen konnten nicht geladen werden");
        return;
      }

      setGroups(json.groups ?? []);
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchGroups();
    }
  }, [projectId, fetchGroups]);

  const createGroup = async (name: string): Promise<DrawingGroup> => {
    const res = await fetch(`/api/projects/${projectId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Gruppe konnte nicht erstellt werden");
    }

    await fetchGroups();
    return json.group;
  };

  const renameGroup = async (groupId: string, name: string) => {
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

    await fetchGroups();
  };

  const archiveGroup = async (groupId: string) => {
    const res = await fetch(
      `/api/projects/${projectId}/groups/${groupId}/archive`,
      { method: "POST" }
    );

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Archivierung fehlgeschlagen");
    }

    await fetchGroups();
  };

  const assignDrawingToGroup = async (
    drawingId: string,
    groupId: string | null
  ) => {
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
  };

  return {
    groups,
    loading,
    error,
    createGroup,
    renameGroup,
    archiveGroup,
    assignDrawingToGroup,
    refetch: fetchGroups,
  };
}

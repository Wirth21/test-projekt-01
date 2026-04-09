"use client";

import { useCallback, useEffect, useState } from "react";
import type { DrawingGroup } from "@/lib/types/drawing";
import { cacheRecords, getCachedByIndex, getSyncMeta, setSyncMeta } from "@/lib/offline/db";

export function useDrawingGroups(projectId: string) {
  const [groups, setGroups] = useState<DrawingGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    const cacheKey = `groups:${projectId}`;

    // Try cache first
    try {
      const cached = await getCachedByIndex<DrawingGroup>("drawing_groups", "by-project", projectId);
      if (cached.length > 0) {
        setGroups(cached);
        setLoading(false);
        const meta = await getSyncMeta(cacheKey);
        if (meta && Date.now() - meta.lastSynced < 30_000) return;
      }
    } catch { /* IndexedDB not available */ }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/groups`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Gruppen konnten nicht geladen werden");
        return;
      }

      const freshGroups = json.groups ?? [];
      setGroups(freshGroups);

      // Cache result
      try {
        await cacheRecords("drawing_groups", freshGroups, projectId);
        await setSyncMeta({ key: cacheKey, lastSynced: Date.now(), tenantId: projectId });
      } catch { /* Cache write failed */ }
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

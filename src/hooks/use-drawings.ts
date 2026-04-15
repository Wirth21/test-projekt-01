"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Drawing, DrawingStatus } from "@/lib/types/drawing";
import { cacheRecords, getCachedByIndex, getSyncMeta, setSyncMeta } from "@/lib/offline/db";
import { useSyncContext } from "@/components/sync/SyncProvider";

export function useDrawings(projectId: string) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { notifySynced } = useSyncContext();

  const supabase = createClient();

  const fetchDrawings = useCallback(async () => {
    // Try cache first
    try {
      const cached = await getCachedByIndex<Drawing>("drawings", "by-project", projectId);
      if (cached.length > 0) {
        setDrawings(cached);
        setLoading(false);
        const meta = await getSyncMeta(`drawings:${projectId}`);
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
      const res = await fetch(`/api/projects/${projectId}/drawings`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Zeichnungen konnten nicht geladen werden");
        return;
      }

      const freshDrawings = json.drawings ?? [];
      setDrawings(freshDrawings);

      // Cache result
      try {
        const tenantId = freshDrawings[0]?.tenant_id ?? projectId;
        await cacheRecords("drawings", freshDrawings, tenantId);
        await setSyncMeta({ key: `drawings:${projectId}`, lastSynced: Date.now(), tenantId });
      } catch { /* Cache write failed */ }
      notifySynced();
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  }, [projectId, notifySynced]);

  useEffect(() => {
    if (projectId) {
      fetchDrawings();
    }
  }, [projectId, fetchDrawings]);

  const uploadDrawing = async (
    file: File,
    onProgress: (pct: number) => void,
    options?: { status_id?: string | null },
  ): Promise<Drawing> => {
    // Generate a unique ID for the drawing
    const drawingId = crypto.randomUUID();
    // New storage path format: {project_id}/{drawing_id}/1.pdf (v1)
    const storagePath = `${projectId}/${drawingId}/1.pdf`;

    // Upload the file directly to Supabase Storage using XMLHttpRequest for progress
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      throw new Error("Nicht eingeloggt");
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const uploadUrl = `${supabaseUrl}/storage/v1/object/drawings/${storagePath}`;

    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl, true);
      xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      xhr.setRequestHeader("x-upsert", "true");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const pct = Math.round((event.loaded / event.total) * 100);
          onProgress(pct);
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error("Upload fehlgeschlagen"));
        }
      };

      xhr.onerror = () => reject(new Error("Upload fehlgeschlagen"));
      xhr.send(file);
    });

    // Record metadata via API (creates drawing + v1 version)
    const payload: Record<string, unknown> = {
      display_name: file.name.replace(/\.pdf$/i, ""),
      storage_path: storagePath,
      file_size: file.size,
    };

    if (options?.status_id) {
      payload.status_id = options.status_id;
    }

    const res = await fetch(`/api/projects/${projectId}/drawings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Metadaten konnten nicht gespeichert werden");
    }

    await fetchDrawings();
    return json.drawing;
  };

  const renameDrawing = async (drawingId: string, displayName: string) => {
    const res = await fetch(
      `/api/projects/${projectId}/drawings/${drawingId}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: displayName }),
      }
    );

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Umbenennung fehlgeschlagen");
    }

    await fetchDrawings();
  };

  const archiveDrawing = async (drawingId: string) => {
    const res = await fetch(
      `/api/projects/${projectId}/drawings/${drawingId}/archive`,
      { method: "POST" }
    );

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Archivierung fehlgeschlagen");
    }

    await fetchDrawings();
  };

  const restoreDrawing = async (drawingId: string) => {
    const res = await fetch(
      `/api/projects/${projectId}/drawings/${drawingId}/restore`,
      { method: "POST" }
    );

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Wiederherstellung fehlgeschlagen");
    }

    await fetchDrawings();
  };

  const getSignedUrl = useCallback(async (drawingId: string): Promise<string> => {
    const res = await fetch(
      `/api/projects/${projectId}/drawings/${drawingId}/url`
    );

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "URL konnte nicht generiert werden");
    }

    return json.url;
  }, [projectId]);

  const updateDrawingVersionStatus = (
    drawingId: string,
    versionId: string,
    statusId: string | null,
    statuses?: DrawingStatus[]
  ) => {
    setDrawings((prev) =>
      prev.map((d) => {
        if (d.id !== drawingId || !d.latest_version || d.latest_version.id !== versionId) return d;
        const status = statusId && statuses ? statuses.find((s) => s.id === statusId) ?? null : null;
        return {
          ...d,
          latest_version: { ...d.latest_version, status_id: statusId, status },
        };
      })
    );
  };

  return {
    drawings,
    loading,
    error,
    uploadDrawing,
    renameDrawing,
    archiveDrawing,
    restoreDrawing,
    getSignedUrl,
    updateDrawingVersionStatus,
    refetch: fetchDrawings,
  };
}

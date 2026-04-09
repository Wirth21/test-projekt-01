"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { DrawingVersion, DrawingStatus } from "@/lib/types/drawing";
import { cacheRecords, getCachedByIndex, getSyncMeta, setSyncMeta } from "@/lib/offline/db";
import { useSyncContext } from "@/components/sync/SyncProvider";

export function useVersions(projectId: string, drawingId: string) {
  const [versions, setVersions] = useState<DrawingVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { notifySynced } = useSyncContext();

  const supabase = createClient();

  const baseUrl = `/api/projects/${projectId}/drawings/${drawingId}/versions`;

  const fetchVersions = useCallback(async () => {
    const cacheKey = `versions:${drawingId}`;

    // Try cache first
    try {
      const cached = await getCachedByIndex<DrawingVersion>("versions", "by-drawing", drawingId);
      if (cached.length > 0) {
        setVersions(cached);
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
      const res = await fetch(`${baseUrl}?includeArchived=true`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Versionen konnten nicht geladen werden");
        return;
      }

      const freshVersions = json.versions ?? [];
      setVersions(freshVersions);

      // Cache result
      try {
        await cacheRecords("versions", freshVersions, projectId);
        await setSyncMeta({ key: cacheKey, lastSynced: Date.now(), tenantId: projectId });
      } catch { /* Cache write failed */ }
      notifySynced();
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  }, [baseUrl, drawingId, projectId]);

  useEffect(() => {
    if (projectId && drawingId) {
      fetchVersions();
    }
  }, [projectId, drawingId, fetchVersions]);

  const uploadVersion = async (
    file: File,
    onProgress: (pct: number) => void,
    label?: string
  ): Promise<{ version: DrawingVersion; markersCopied: number; markerCopyFailed: boolean }> => {
    // Determine next version number
    const maxVersionNumber = versions.reduce(
      (max, v) => Math.max(max, v.version_number),
      0
    );
    const nextVersionNumber = maxVersionNumber + 1;

    const storagePath = `${projectId}/${drawingId}/${nextVersionNumber}.pdf`;

    // Upload the file directly to Supabase Storage with progress
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

    // Record metadata via API (server also copies markers)
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storage_path: storagePath,
        file_size: file.size,
        ...(label ? { label } : {}),
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Version konnte nicht gespeichert werden");
    }

    await fetchVersions();
    return {
      version: json.version,
      markersCopied: json.markers_copied ?? 0,
      markerCopyFailed: json.marker_copy_failed ?? false,
    };
  };

  const renameVersion = async (versionId: string, label: string) => {
    const res = await fetch(`${baseUrl}/${versionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Umbenennung fehlgeschlagen");
    }

    await fetchVersions();
  };

  const archiveVersion = async (versionId: string) => {
    const res = await fetch(`${baseUrl}/${versionId}/archive`, {
      method: "POST",
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error ?? "Archivierung fehlgeschlagen");
    }

    await fetchVersions();
  };

  const getVersionSignedUrl = useCallback(
    async (versionId: string): Promise<string> => {
      const res = await fetch(`${baseUrl}/${versionId}/url`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "URL konnte nicht generiert werden");
      }
      return json.url;
    },
    [baseUrl]
  );

  const updateVersionStatus = (versionId: string, statusId: string | null, statuses?: DrawingStatus[]) => {
    setVersions((prev) =>
      prev.map((v) =>
        v.id === versionId
          ? {
              ...v,
              status_id: statusId,
              status: statusId && statuses
                ? statuses.find((s) => s.id === statusId) ?? null
                : null,
            }
          : v
      )
    );
  };

  /** Returns the latest non-archived version, or null if none exist */
  const latestActiveVersion = versions
    .filter((v) => !v.is_archived)
    .sort((a, b) => b.version_number - a.version_number)[0] ?? null;

  return {
    versions,
    loading,
    error,
    latestActiveVersion,
    uploadVersion,
    renameVersion,
    archiveVersion,
    getVersionSignedUrl,
    updateVersionStatus,
    refetch: fetchVersions,
  };
}

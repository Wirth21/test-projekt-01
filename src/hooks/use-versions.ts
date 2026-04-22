"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { renderPdfThumbnail } from "@/lib/thumbnails/render";
import { uploadThumbnail } from "@/lib/thumbnails/upload";
import type { DrawingVersion, DrawingStatus } from "@/lib/types/drawing";

export function useVersions(projectId: string, drawingId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const baseUrl = `/api/projects/${projectId}/drawings/${drawingId}/versions`;

  const {
    data: versions = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery<DrawingVersion[]>({
    queryKey: ["versions", projectId, drawingId],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}?includeArchived=true`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Versionen konnten nicht geladen werden");
      }

      return json.versions ?? [];
    },
    staleTime: 30_000,
    enabled: !!projectId && !!drawingId,
  });

  const error = queryError ? (queryError as Error).message : null;

  const uploadVersion = useCallback(
    async (
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

      // Best-effort thumbnail rendering + upload (see use-drawings.ts).
      let thumbnailPath: string | null = null;
      try {
        const jpeg = await renderPdfThumbnail(file);
        if (jpeg) thumbnailPath = await uploadThumbnail(storagePath, jpeg);
      } catch {
        thumbnailPath = null;
      }

      // Record metadata via API (server also copies markers)
      const res = await fetch(baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storage_path: storagePath,
          file_size: file.size,
          ...(label ? { label } : {}),
          ...(thumbnailPath ? { thumbnail_path: thumbnailPath } : {}),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Version konnte nicht gespeichert werden");
      }

      await queryClient.invalidateQueries({ queryKey: ["versions", projectId, drawingId] });
      await queryClient.invalidateQueries({ queryKey: ["drawings", projectId] });
      return {
        version: json.version,
        markersCopied: json.markers_copied ?? 0,
        markerCopyFailed: json.marker_copy_failed ?? false,
      };
    },
    [baseUrl, projectId, drawingId, versions, queryClient, supabase.auth]
  );

  const renameVersion = useCallback(
    async (versionId: string, label: string) => {
      const res = await fetch(`${baseUrl}/${versionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Umbenennung fehlgeschlagen");
      }

      await queryClient.invalidateQueries({ queryKey: ["versions", projectId, drawingId] });
    },
    [baseUrl, projectId, drawingId, queryClient]
  );

  const archiveVersion = useCallback(
    async (versionId: string) => {
      const res = await fetch(`${baseUrl}/${versionId}/archive`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Archivierung fehlgeschlagen");
      }

      await queryClient.invalidateQueries({ queryKey: ["versions", projectId, drawingId] });
      await queryClient.invalidateQueries({ queryKey: ["drawings", projectId] });
    },
    [baseUrl, projectId, drawingId, queryClient]
  );

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

  const updateVersionStatus = useCallback(
    (versionId: string, statusId: string | null, statuses?: DrawingStatus[]) => {
      queryClient.setQueryData<DrawingVersion[]>(["versions", projectId, drawingId], (prev) =>
        (prev ?? []).map((v) =>
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
    },
    [projectId, drawingId, queryClient]
  );

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
    refetch,
  };
}

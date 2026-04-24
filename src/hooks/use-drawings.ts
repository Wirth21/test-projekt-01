"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { renderPdfThumbnail } from "@/lib/thumbnails/render";
import { uploadThumbnail } from "@/lib/thumbnails/upload";
import type { Drawing, DrawingStatus } from "@/lib/types/drawing";

export function useDrawings(projectId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();

  const {
    data: drawings = [],
    isLoading: loading,
    error: queryError,
    refetch,
  } = useQuery<Drawing[]>({
    queryKey: ["drawings", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${projectId}/drawings`);
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error ?? "Zeichnungen konnten nicht geladen werden");
      }

      return json.drawings ?? [];
    },
    staleTime: 30_000,
    enabled: !!projectId,
  });

  const error = queryError ? (queryError as Error).message : null;

  const uploadDrawing = useCallback(
    async (
      file: File,
      onProgress: (pct: number) => void,
      options?: { status_id?: string | null; group_id?: string | null },
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

      // Best-effort: render page 1 to a small JPEG and upload it as a
      // thumbnail. If this fails (corrupt PDF, storage error, …) the PDF
      // upload has already succeeded — viewers will fall back to client-side
      // PDF rendering for the preview.
      let thumbnailPath: string | null = null;
      try {
        const jpeg = await renderPdfThumbnail(file);
        if (jpeg) thumbnailPath = await uploadThumbnail(storagePath, jpeg);
      } catch {
        thumbnailPath = null;
      }

      // Record metadata via API (creates drawing + v1 version)
      const payload: Record<string, unknown> = {
        display_name: file.name.replace(/\.pdf$/i, ""),
        storage_path: storagePath,
        file_size: file.size,
      };

      if (options?.status_id) {
        payload.status_id = options.status_id;
      }
      // group_id can be null (explicit "ungrouped") — distinguish from undefined.
      if (options && "group_id" in options) {
        payload.group_id = options.group_id;
      }
      if (thumbnailPath) {
        payload.thumbnail_path = thumbnailPath;
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

      await queryClient.invalidateQueries({ queryKey: ["drawings", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      return json.drawing;
    },
    [projectId, queryClient, supabase.auth]
  );

  const renameDrawing = useCallback(
    async (drawingId: string, displayName: string) => {
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

      await queryClient.invalidateQueries({ queryKey: ["drawings", projectId] });
    },
    [projectId, queryClient]
  );

  const archiveDrawing = useCallback(
    async (drawingId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/drawings/${drawingId}/archive`,
        { method: "POST" }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Archivierung fehlgeschlagen");
      }

      await queryClient.invalidateQueries({ queryKey: ["drawings", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    [projectId, queryClient]
  );

  const restoreDrawing = useCallback(
    async (drawingId: string) => {
      const res = await fetch(
        `/api/projects/${projectId}/drawings/${drawingId}/restore`,
        { method: "POST" }
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Wiederherstellung fehlgeschlagen");
      }

      await queryClient.invalidateQueries({ queryKey: ["drawings", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    [projectId, queryClient]
  );

  const getSignedUrl = useCallback(
    async (drawingId: string): Promise<string> => {
      const res = await fetch(
        `/api/projects/${projectId}/drawings/${drawingId}/url`
      );

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "URL konnte nicht generiert werden");
      }

      return json.url;
    },
    [projectId]
  );

  const updateDrawingVersionStatus = useCallback(
    (
      drawingId: string,
      versionId: string,
      statusId: string | null,
      statuses?: DrawingStatus[]
    ) => {
      queryClient.setQueryData<Drawing[]>(["drawings", projectId], (prev) =>
        (prev ?? []).map((d) => {
          if (d.id !== drawingId || !d.latest_version || d.latest_version.id !== versionId) return d;
          const status = statusId && statuses ? statuses.find((s) => s.id === statusId) ?? null : null;
          return {
            ...d,
            latest_version: { ...d.latest_version, status_id: statusId, status },
          };
        })
      );
    },
    [projectId, queryClient]
  );

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
    refetch,
  };
}

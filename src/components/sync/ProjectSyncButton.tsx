"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { CloudDownload, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { cacheRecords } from "@/lib/offline/db";
import { fetchPdfWithCache, isPdfCached } from "@/lib/offline/pdf-cache";
import { useSyncContext } from "./SyncProvider";

interface ProjectSyncButtonProps {
  projectId: string;
  /** Function to fetch all drawings for this project */
  fetchDrawings: () => Promise<Record<string, unknown>[]>;
  /** Function to fetch all versions for a drawing */
  fetchVersions: (drawingId: string) => Promise<Record<string, unknown>[]>;
  /** Function to fetch all markers for a drawing */
  fetchMarkers: (drawingId: string) => Promise<Record<string, unknown>[]>;
  /** Function to fetch drawing groups for this project */
  fetchGroups: () => Promise<Record<string, unknown>[]>;
  /** Function to get a signed URL for a version */
  getVersionSignedUrl: (versionId: string, drawingId: string) => Promise<string>;
}

interface SyncProgress {
  phase: "metadata" | "pdfs" | "done" | "error";
  totalPdfs: number;
  downloadedPdfs: number;
  skippedPdfs: number;
  currentPdf: string;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ProjectSyncButton({
  projectId,
  fetchDrawings,
  fetchVersions,
  fetchMarkers,
  fetchGroups,
  getVersionSignedUrl,
}: ProjectSyncButtonProps) {
  const t = useTranslations("sync");
  const { tenantId, isOnline } = useSyncContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const startSync = useCallback(async () => {
    if (!tenantId) return;

    const controller = new AbortController();
    setAbortController(controller);
    setSyncing(true);

    setProgress({
      phase: "metadata",
      totalPdfs: 0,
      downloadedPdfs: 0,
      skippedPdfs: 0,
      currentPdf: "",
    });

    try {
      // Phase 1: Fetch and cache all metadata
      const drawings = await fetchDrawings();
      await cacheRecords("drawings", drawings, tenantId);

      if (controller.signal.aborted) return;

      const groups = await fetchGroups();
      await cacheRecords("drawing_groups", groups, tenantId);

      if (controller.signal.aborted) return;

      // Fetch versions and markers for each drawing
      const allVersions: Record<string, unknown>[] = [];
      for (const drawing of drawings) {
        if (controller.signal.aborted) return;
        const drawingId = drawing.id as string;

        const versions = await fetchVersions(drawingId);
        allVersions.push(...versions);
        await cacheRecords("versions", versions, tenantId);

        const markers = await fetchMarkers(drawingId);
        await cacheRecords("markers", markers, tenantId);
      }

      if (controller.signal.aborted) return;

      // Phase 2: Download PDFs
      // Filter to active (non-archived) versions only
      const activeVersions = allVersions.filter(
        (v) => !(v.is_archived as boolean)
      );

      setProgress((prev) => ({
        ...prev!,
        phase: "pdfs",
        totalPdfs: activeVersions.length,
      }));

      let downloaded = 0;
      let skipped = 0;

      for (const version of activeVersions) {
        if (controller.signal.aborted) return;

        const versionId = version.id as string;
        const label = (version.label as string) || `Version ${version.version_number}`;

        setProgress((prev) => ({
          ...prev!,
          currentPdf: label,
        }));

        try {
          // Get signed URL
          const drawingId = version.drawing_id as string;
          const signedUrl = await getVersionSignedUrl(versionId, drawingId);

          // Check if already cached
          const cached = await isPdfCached(signedUrl);
          if (cached) {
            skipped++;
          } else {
            await fetchPdfWithCache(signedUrl);
            downloaded++;
          }
        } catch {
          // Skip failed PDFs, continue with the rest
          downloaded++; // Count as attempted
        }

        setProgress((prev) => ({
          ...prev!,
          downloadedPdfs: downloaded,
          skippedPdfs: skipped,
        }));
      }

      setProgress((prev) => ({
        ...prev!,
        phase: "done",
      }));

      toast.success(t("projectSynced"));
    } catch (err) {
      if (!controller.signal.aborted) {
        setProgress((prev) =>
          prev
            ? {
                ...prev,
                phase: "error",
                error:
                  err instanceof Error ? err.message : t("syncFailed"),
              }
            : null
        );
        toast.error(t("syncFailed"));
      }
    } finally {
      setSyncing(false);
      setAbortController(null);
    }
  }, [
    tenantId,
    fetchDrawings,
    fetchVersions,
    fetchMarkers,
    fetchGroups,
    getVersionSignedUrl,
    t,
  ]);

  function handleCancel() {
    abortController?.abort();
    setSyncing(false);
    setProgress(null);
    setDialogOpen(false);
  }

  function handleClose() {
    if (!syncing) {
      setProgress(null);
      setDialogOpen(false);
    }
  }

  const progressPercent =
    progress && progress.totalPdfs > 0
      ? Math.round(
          ((progress.downloadedPdfs + progress.skippedPdfs) /
            progress.totalPdfs) *
            100
        )
      : 0;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => {
          setDialogOpen(true);
          startSync();
        }}
        disabled={!isOnline || syncing}
      >
        <CloudDownload className="h-4 w-4" />
        {t("syncProject")}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={handleClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("syncProject")}</DialogTitle>
            <DialogDescription>
              {progress?.phase === "metadata" && t("syncingMetadata")}
              {progress?.phase === "pdfs" && t("syncingPdfs")}
              {progress?.phase === "done" && t("syncComplete")}
              {progress?.phase === "error" && (progress.error || t("syncFailed"))}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {progress?.phase === "metadata" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {t("syncingMetadata")}
              </div>
            )}

            {progress?.phase === "pdfs" && (
              <>
                <Progress value={progressPercent} />
                <div className="text-sm text-muted-foreground">
                  {t("syncProgress", {
                    current: progress.downloadedPdfs + progress.skippedPdfs,
                    total: progress.totalPdfs,
                  })}
                  {progress.skippedPdfs > 0 && (
                    <span className="ml-1">
                      ({t("syncSkipped", { count: progress.skippedPdfs })})
                    </span>
                  )}
                </div>
                {progress.currentPdf && (
                  <div className="text-xs text-muted-foreground truncate">
                    {progress.currentPdf}
                  </div>
                )}
              </>
            )}

            {progress?.phase === "done" && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                {t("syncCompleteDetail", {
                  downloaded: progress.downloadedPdfs,
                  skipped: progress.skippedPdfs,
                })}
              </div>
            )}

            {progress?.phase === "error" && (
              <div className="flex items-center gap-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                {progress.error}
              </div>
            )}
          </div>

          <DialogFooter>
            {syncing ? (
              <Button variant="outline" onClick={handleCancel}>
                {t("cancel")}
              </Button>
            ) : (
              <Button onClick={handleClose}>{t("close")}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

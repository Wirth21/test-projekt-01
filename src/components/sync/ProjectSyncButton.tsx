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
  const { tenantId, isOnline, notifySynced } = useSyncContext();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [abortController, setAbortController] =
    useState<AbortController | null>(null);

  const startSync = useCallback(async () => {
    // If tenantId isn't loaded yet, fetch it directly
    let tid = tenantId;
    if (!tid) {
      try {
        const { createClient } = await import("@/lib/supabase");
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("tenant_id")
            .eq("id", user.id)
            .single();
          tid = profile?.tenant_id ?? null;
        }
      } catch {
        // Ignore
      }
    }
    if (!tid) {
      toast.error(t("syncFailed"));
      return;
    }

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
      await cacheRecords("drawings", drawings, tid);

      if (controller.signal.aborted) return;

      const groups = await fetchGroups();
      await cacheRecords("drawing_groups", groups, tid);

      if (controller.signal.aborted) return;

      // Fetch versions and markers for each drawing
      const allVersions: Record<string, unknown>[] = [];
      for (const drawing of drawings) {
        if (controller.signal.aborted) return;
        const drawingId = drawing.id as string;

        const versions = await fetchVersions(drawingId);
        allVersions.push(...versions);
        await cacheRecords("versions", versions, tid);

        const markers = await fetchMarkers(drawingId);
        await cacheRecords("markers", markers, tid);
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
        }

        setProgress((prev) => ({
          ...prev!,
          downloadedPdfs: downloaded,
          skippedPdfs: skipped,
        }));
      }

      // Phase 3: Prefetch navigation pages for offline access
      if (controller.signal.aborted) return;
      setProgress((prev) => ({
        ...prev!,
        phase: "pdfs",
        currentPdf: t("syncingPages"),
      }));
      try {
        const routesToPrefetch = [
          "/dashboard",
          `/dashboard/projects/${projectId}`,
          ...drawings.map(
            (d) => `/dashboard/projects/${projectId}/drawings/${d.id as string}`
          ),
        ];

        const cache = await caches.open("link2plan-app-v3");
        for (const route of routesToPrefetch) {
          if (controller.signal.aborted) return;
          try {
            const fullUrl = new URL(route, window.location.origin).toString();
            const res = await fetch(fullUrl, { credentials: "include" });
            if (res.ok) {
              await cache.put(route, res.clone());
              await cache.put(fullUrl, res.clone());
            }
          } catch {
            // Individual page prefetch failure is non-critical
          }
        }
      } catch {
        // Prefetch failure is non-critical
      }

      setProgress((prev) => ({
        ...prev!,
        phase: "done",
      }));

      notifySynced();
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
    notifySynced,
    projectId,
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

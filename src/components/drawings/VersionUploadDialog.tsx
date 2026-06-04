"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PdfUploadZone } from "@/components/drawings/PdfUploadZone";
import { StatusDateFields } from "@/components/drawings/StatusDateFields";
import { useTranslations } from "next-intl";
import type { DrawingStatus } from "@/lib/types/drawing";
import {
  dateInputToIso,
  resolveDefaultStatusId,
  setLastStatusId,
  todayIso,
} from "@/lib/upload-prefs";
import type { UploadMeta } from "@/components/drawings/UploadStatusDateDialog";

interface VersionUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawingName: string;
  onUpload: (file: File, onProgress: (pct: number) => void, meta: UploadMeta) => Promise<void>;
  /** Available statuses for the tenant (PROJ-30). */
  statuses?: DrawingStatus[];
}

export function VersionUploadDialog({
  open,
  onOpenChange,
  drawingName,
  onUpload,
  statuses = [],
}: VersionUploadDialogProps) {
  const t = useTranslations("drawings");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusId, setStatusId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [wasOpen, setWasOpen] = useState(false);

  // Seed defaults (last-used status + today) on the closed→open transition.
  // Done during render to avoid a setState-in-effect cascade.
  if (open && !wasOpen) {
    setWasOpen(true);
    const tenantDefault = statuses.find((s) => s.is_default)?.id ?? null;
    setStatusId(resolveDefaultStatusId(statuses, tenantDefault));
    setDate(todayIso());
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  function handleOpenChange(newOpen: boolean) {
    if (!uploading) {
      onOpenChange(newOpen);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setProgress(0);
    try {
      await onUpload(file, (pct) => setProgress(pct), {
        statusId,
        createdAtIso: dateInputToIso(date),
      });
      setLastStatusId(statusId);
      onOpenChange(false);
    } catch {
      // Error handled by caller via toast
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("versions.upload.title")}</DialogTitle>
          <DialogDescription>
            {t("versions.upload.description", { name: drawingName })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <StatusDateFields
            statuses={statuses}
            statusId={statusId}
            date={date}
            onStatusChange={setStatusId}
            onDateChange={setDate}
            disabled={uploading}
          />
          <PdfUploadZone
            onUpload={handleUpload}
            uploading={uploading}
            progress={progress}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

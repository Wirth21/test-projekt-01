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
import { useTranslations } from "next-intl";

interface VersionUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawingName: string;
  onUpload: (file: File, onProgress: (pct: number) => void) => Promise<void>;
}

export function VersionUploadDialog({
  open,
  onOpenChange,
  drawingName,
  onUpload,
}: VersionUploadDialogProps) {
  const t = useTranslations("drawings");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  function handleOpenChange(newOpen: boolean) {
    if (!uploading) {
      onOpenChange(newOpen);
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setProgress(0);
    try {
      await onUpload(file, (pct) => setProgress(pct));
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
        <div className="py-2">
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

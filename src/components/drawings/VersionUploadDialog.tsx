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
          <DialogTitle>Neue Version hochladen</DialogTitle>
          <DialogDescription>
            Lade eine neue PDF-Version fuer &ldquo;{drawingName}&rdquo; hoch. Die
            aktuelle Version wird beibehalten und Marker werden automatisch
            uebernommen.
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

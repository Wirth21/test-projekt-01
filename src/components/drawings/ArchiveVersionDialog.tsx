"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ArchiveVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionLabel: string;
  versionNumber: number;
  onConfirm: () => Promise<void>;
}

export function ArchiveVersionDialog({
  open,
  onOpenChange,
  versionLabel,
  versionNumber,
  onConfirm,
}: ArchiveVersionDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error handled by caller via toast
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Version archivieren?</AlertDialogTitle>
          <AlertDialogDescription>
            Version v{versionNumber} ({versionLabel}) wird archiviert. Die Datei
            bleibt erhalten und kann weiterhin eingesehen werden, wird aber
            ausgegraut dargestellt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Abbrechen</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Archivieren
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

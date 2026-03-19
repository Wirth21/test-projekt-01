"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ArchiveDrawingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawingName: string;
  onConfirm: () => Promise<void>;
}

export function ArchiveDrawingDialog({
  open,
  onOpenChange,
  drawingName,
  onConfirm,
}: ArchiveDrawingDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error handling is done in the parent via toast
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Zeichnung archivieren?</AlertDialogTitle>
          <AlertDialogDescription>
            Die Zeichnung <strong>&quot;{drawingName}&quot;</strong> wird
            archiviert und ist nicht mehr in der aktiven Liste sichtbar. Die
            Datei bleibt im Speicher erhalten und kann nicht geloescht werden.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Abbrechen
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Archivieren
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

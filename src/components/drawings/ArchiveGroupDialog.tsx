"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ArchiveGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  activeDrawingCount: number;
  onConfirm: () => Promise<void>;
}

export function ArchiveGroupDialog({
  open,
  onOpenChange,
  groupName,
  activeDrawingCount,
  onConfirm,
}: ArchiveGroupDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    setSubmitting(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Error is handled by the caller via toast
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Gruppe &bdquo;{groupName}&ldquo; archivieren?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {activeDrawingCount > 0 ? (
              <>
                {activeDrawingCount === 1
                  ? "1 Zeichnung wird nach \"Ohne Gruppe\" verschoben."
                  : `${activeDrawingCount} Zeichnungen werden nach "Ohne Gruppe" verschoben.`}
                {" "}Die Gruppe kann spaeter nicht wiederhergestellt werden.
              </>
            ) : (
              "Die leere Gruppe wird archiviert und aus der Uebersicht entfernt."
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>Abbrechen</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Archivieren
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

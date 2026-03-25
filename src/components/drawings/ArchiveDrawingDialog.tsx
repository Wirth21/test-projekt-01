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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("drawings");
  const tc = useTranslations("common");
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
          <AlertDialogTitle>{t("archiveConfirm.title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t.rich("archiveConfirm.description", {
              name: drawingName,
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {tc("cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("archiveConfirm.submit")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

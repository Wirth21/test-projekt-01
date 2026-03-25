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
import { useTranslations } from "next-intl";

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
  const t = useTranslations("drawings");
  const tc = useTranslations("common");
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
            {t("groups.archiveConfirm.title", { name: groupName })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {activeDrawingCount > 0 ? (
              <>
                {activeDrawingCount === 1
                  ? t("groups.archiveConfirm.descriptionSingular")
                  : t("groups.archiveConfirm.descriptionPlural", { count: activeDrawingCount })}
                {" "}{t("groups.archiveConfirm.descriptionPermanent")}
              </>
            ) : (
              t("groups.archiveConfirm.descriptionEmpty")
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>{tc("cancel")}</AlertDialogCancel>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("groups.archiveConfirm.submit")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

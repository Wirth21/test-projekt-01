"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusDateFields } from "@/components/drawings/StatusDateFields";
import { useTranslations } from "next-intl";
import type { DrawingStatus } from "@/lib/types/drawing";
import { dateInputToIso, resolveDefaultStatusId, todayIso } from "@/lib/upload-prefs";

export interface UploadMeta {
  statusId: string | null;
  createdAtIso: string;
}

interface UploadStatusDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statuses: DrawingStatus[];
  /** How many drawings this choice applies to (for the description). */
  fileCount: number;
  onConfirm: (meta: UploadMeta) => void;
}

/**
 * PROJ-30 — Asked once before a new-drawing upload: status + (plan) date.
 * Defaults to the last-used status and today's date. For multi-file drops the
 * choice is applied to all files.
 */
export function UploadStatusDateDialog({
  open,
  onOpenChange,
  statuses,
  fileCount,
  onConfirm,
}: UploadStatusDateDialogProps) {
  const t = useTranslations("drawings");
  const tc = useTranslations("common");
  const [statusId, setStatusId] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [wasOpen, setWasOpen] = useState(false);

  // Seed defaults (last-used status + today) on the closed→open transition.
  // Done during render (React's "adjust state on prop change" pattern) to
  // avoid a setState-in-effect cascade.
  if (open && !wasOpen) {
    setWasOpen(true);
    const tenantDefault = statuses.find((s) => s.is_default)?.id ?? null;
    setStatusId(resolveDefaultStatusId(statuses, tenantDefault));
    setDate(todayIso());
  } else if (!open && wasOpen) {
    setWasOpen(false);
  }

  function handleConfirm() {
    onConfirm({ statusId, createdAtIso: dateInputToIso(date) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{t("uploadOptions.title")}</DialogTitle>
          <DialogDescription>
            {fileCount > 1
              ? t("uploadOptions.descriptionMultiple", { count: fileCount })
              : t("uploadOptions.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="py-1">
          <StatusDateFields
            statuses={statuses}
            statusId={statusId}
            date={date}
            onStatusChange={setStatusId}
            onDateChange={setDate}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={handleConfirm}>{t("uploadOptions.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

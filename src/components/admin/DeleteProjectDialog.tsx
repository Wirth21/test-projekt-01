"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatBytes } from "@/lib/plan-limits";
import type { AdminTenantProject } from "@/lib/types/admin";

interface DeleteProjectDialogProps {
  /** Project to delete, or null when the dialog is closed. */
  project: AdminTenantProject | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (projectId: string) => Promise<void>;
}

export function DeleteProjectDialog({
  project,
  open,
  onOpenChange,
  onConfirm,
}: DeleteProjectDialogProps) {
  const t = useTranslations("admin.projects.delete");
  const tc = useTranslations("common");

  const [confirmInput, setConfirmInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset state on (re-)open and on project change.
  useEffect(() => {
    if (open) {
      setConfirmInput("");
      setErrorMsg(null);
      setSubmitting(false);
    }
  }, [open, project?.id]);

  if (!project) {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent />
      </AlertDialog>
    );
  }

  const canConfirm = confirmInput === project.name && !submitting;

  async function handleConfirm() {
    if (!project || !canConfirm) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await onConfirm(project.id);
      // Parent closes the dialog; we just reset locally.
      setConfirmInput("");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : t("errorFallback")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // Prevent closing via ESC/Overlay while a delete is in flight.
        if (submitting) return;
        onOpenChange(next);
      }}
    >
      <AlertDialogContent
        onEscapeKeyDown={(e) => {
          if (submitting) e.preventDefault();
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle
              className="h-5 w-5 text-destructive shrink-0"
              aria-hidden="true"
            />
            {t("title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="sr-only">
            {t("srDescription")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Project name */}
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("projectLabel")}
            </p>
            <p
              className="mt-1 text-lg font-semibold break-words"
              data-testid="delete-project-name"
            >
              {project.name}
            </p>
          </div>

          {/* What will be deleted */}
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-sm font-medium mb-2">{t("whatHeading")}</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>{t("counts.drawings", { count: project.drawings_count })}</li>
              <li>{t("counts.versions", { count: project.versions_count })}</li>
              <li>{t("counts.members", { count: project.members_count })}</li>
              <li>{t("counts.groups", { count: project.groups_count })}</li>
              <li>
                {t("counts.storage", {
                  size: formatBytes(project.storage_bytes),
                })}
              </li>
            </ul>
          </div>

          {/* Irreversible warning */}
          <div
            className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            {t("irreversible")}
          </div>

          {/* Type-to-confirm */}
          <div className="space-y-1.5">
            <Label htmlFor="delete-project-confirm" className="text-sm">
              {t("confirmLabel")}
            </Label>
            <Input
              id="delete-project-confirm"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder={project.name}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={submitting}
              aria-describedby="delete-project-confirm-hint"
            />
            <p
              id="delete-project-confirm-hint"
              className="text-xs text-muted-foreground"
            >
              {t("confirmHint")}
            </p>
          </div>

          {/* Error */}
          {errorMsg && (
            <div
              className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
              role="alert"
            >
              {errorMsg}
            </div>
          )}
        </div>

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
            disabled={!canConfirm}
            data-testid="delete-project-confirm"
          >
            {submitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

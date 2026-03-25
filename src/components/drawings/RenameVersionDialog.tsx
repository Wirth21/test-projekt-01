"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslations } from "next-intl";

interface RenameVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentLabel: string;
  versionNumber: number;
  onSubmit: (label: string) => Promise<void>;
}

export function RenameVersionDialog({
  open,
  onOpenChange,
  currentLabel,
  versionNumber,
  onSubmit,
}: RenameVersionDialogProps) {
  const t = useTranslations("drawings");
  const tc = useTranslations("common");
  const [label, setLabel] = useState(currentLabel);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(newOpen: boolean) {
    if (!submitting) {
      onOpenChange(newOpen);
      if (newOpen) {
        setLabel(currentLabel);
        setError(null);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = label.trim();
    if (!trimmed) {
      setError(t("validation.labelRequired"));
      return;
    }
    if (trimmed.length > 100) {
      setError(t("validation.labelMaxLength"));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("toasts.renameFailed")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{t("versions.rename.title", { number: versionNumber })}</DialogTitle>
          <DialogDescription>
            {t("versions.rename.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="py-4">
            <Label htmlFor="version-label">{t("versions.rename.label")}</Label>
            <Input
              id="version-label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={100}
              className="mt-1.5"
              autoFocus
              disabled={submitting}
            />
            {error && (
              <p className="text-sm text-destructive mt-1.5" role="alert">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={submitting || !label.trim()}>
              {submitting && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

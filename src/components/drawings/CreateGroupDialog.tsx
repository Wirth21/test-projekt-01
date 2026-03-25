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

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
  existingNames: string[];
}

export function CreateGroupDialog({
  open,
  onOpenChange,
  onSubmit,
  existingNames,
}: CreateGroupDialogProps) {
  const t = useTranslations("drawings");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = name.trim();
  const isDuplicate = existingNames.some(
    (n) => n.toLowerCase() === trimmed.toLowerCase()
  );
  const isValid = trimmed.length >= 1 && trimmed.length <= 100 && !isDuplicate;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName("");
      setError(null);
    }
    onOpenChange(nextOpen);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(trimmed);
      setName("");
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("toasts.groupCreateFailed")
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("groups.create.title")}</DialogTitle>
          <DialogDescription>
            {t("groups.create.description")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-2 py-4">
            <Label htmlFor="group-name">{t("groups.create.label")}</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder={t("groups.create.placeholder")}
              maxLength={100}
              autoFocus
              disabled={submitting}
            />
            {isDuplicate && (
              <p className="text-sm text-destructive">
                {t("groups.create.duplicateError")}
              </p>
            )}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
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
            <Button type="submit" disabled={!isValid || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {tc("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

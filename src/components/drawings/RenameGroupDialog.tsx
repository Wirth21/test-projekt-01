"use client";

import { useEffect, useState } from "react";
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

interface RenameGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onSubmit: (name: string) => Promise<void>;
  existingNames: string[];
}

export function RenameGroupDialog({
  open,
  onOpenChange,
  currentName,
  onSubmit,
  existingNames,
}: RenameGroupDialogProps) {
  const [name, setName] = useState(currentName);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(currentName);
      setError(null);
    }
  }, [open, currentName]);

  const trimmed = name.trim();
  const isDuplicate = existingNames.some(
    (n) =>
      n.toLowerCase() === trimmed.toLowerCase() &&
      n.toLowerCase() !== currentName.toLowerCase()
  );
  const hasChanged = trimmed !== currentName;
  const isValid =
    trimmed.length >= 1 &&
    trimmed.length <= 100 &&
    !isDuplicate &&
    hasChanged;

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setName(currentName);
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
      onOpenChange(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Umbenennung fehlgeschlagen"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gruppe umbenennen</DialogTitle>
          <DialogDescription>
            Gib einen neuen Namen fuer die Gruppe ein.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-2 py-4">
            <Label htmlFor="rename-group-name">Gruppenname</Label>
            <Input
              id="rename-group-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              maxLength={100}
              autoFocus
              disabled={submitting}
            />
            {isDuplicate && (
              <p className="text-sm text-destructive">
                Eine Gruppe mit diesem Namen existiert bereits.
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
              Abbrechen
            </Button>
            <Button type="submit" disabled={!isValid || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

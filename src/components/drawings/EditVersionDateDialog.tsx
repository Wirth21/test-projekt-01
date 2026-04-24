"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EditVersionDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versionNumber: number;
  currentDate: string;
  onSubmit: (isoDate: string) => Promise<void>;
}

// YYYY-MM-DD → start-of-day UTC ISO-8601.
function toIsoAtMidnightUtc(yyyyMmDd: string): string {
  // Re-assemble to avoid local-TZ offset surprises; users select a calendar day.
  return `${yyyyMmDd}T00:00:00.000Z`;
}

function toInputValue(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function EditVersionDateDialog({
  open,
  onOpenChange,
  versionNumber,
  currentDate,
  onSubmit,
}: EditVersionDateDialogProps) {
  const [value, setValue] = useState(toInputValue(currentDate));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(toInputValue(currentDate));
      setError(null);
    }
  }, [open, currentDate]);

  async function handleSave() {
    if (!value) {
      setError("Bitte ein Datum auswählen.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(toIsoAtMidnightUtc(value));
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (saving) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Datum von v{versionNumber} ändern</DialogTitle>
          <DialogDescription>
            Ändert das angezeigte Datum dieser Version. Der Änderungsverlauf
            bleibt erhalten.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="version-date">Datum</Label>
          <Input
            id="version-date"
            type="date"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            disabled={saving}
          />
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !value}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

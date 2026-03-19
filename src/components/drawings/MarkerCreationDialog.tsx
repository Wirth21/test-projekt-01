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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Drawing } from "@/lib/types/drawing";

interface MarkerCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawings: Drawing[];
  currentDrawingId: string;
  onSubmit: (name: string, targetDrawingId: string) => Promise<void>;
}

export function MarkerCreationDialog({
  open,
  onOpenChange,
  drawings,
  currentDrawingId,
  onSubmit,
}: MarkerCreationDialogProps) {
  const [name, setName] = useState("");
  const [targetId, setTargetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableDrawings = drawings.filter(
    (d) => d.id !== currentDrawingId && !d.is_archived
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !targetId) return;

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(name.trim(), targetId);
      setName("");
      setTargetId("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen");
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setName("");
      setTargetId("");
      setError(null);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Neuer Marker</DialogTitle>
            <DialogDescription>
              Setze einen Marker, der auf eine andere Zeichnung verweist.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="marker-name">Name</Label>
              <Input
                id="marker-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Detail A - Schnitt 1"
                maxLength={50}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                {name.length}/50 Zeichen
              </p>
            </div>

            <div className="space-y-2">
              <Label>Ziel-Zeichnung</Label>
              <Select value={targetId} onValueChange={setTargetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Zeichnung auswählen..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDrawings.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      Keine anderen Zeichnungen vorhanden
                    </div>
                  ) : (
                    availableDrawings.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.display_name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !targetId || submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Marker erstellen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

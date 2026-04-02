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
import type { MarkerColor } from "@/lib/types/marker";
import { MARKER_COLORS, MARKER_COLOR_MAP } from "@/lib/types/marker";
import { useTranslations } from "next-intl";

interface MarkerCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drawings: Drawing[];
  currentDrawingId: string;
  onSubmit: (name: string, targetDrawingId: string, color: MarkerColor) => Promise<void>;
}

export function MarkerCreationDialog({
  open,
  onOpenChange,
  drawings,
  currentDrawingId,
  onSubmit,
}: MarkerCreationDialogProps) {
  const t = useTranslations("markers");
  const tc = useTranslations("common");
  const [name, setName] = useState("");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [targetId, setTargetId] = useState("");
  const [color, setColor] = useState<MarkerColor>("blue");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableDrawings = drawings.filter(
    (d) => d.id !== currentDrawingId && !d.is_archived
  );

  function handleTargetChange(id: string) {
    setTargetId(id);
    // Auto-fill name from drawing name if not manually edited
    if (!nameManuallyEdited) {
      const drawing = availableDrawings.find((d) => d.id === id);
      if (drawing) {
        setName(drawing.display_name.slice(0, 50));
      }
    }
  }

  function handleNameChange(value: string) {
    setName(value);
    setNameManuallyEdited(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !targetId) return;

    setSubmitting(true);
    setError(null);

    try {
      await onSubmit(name.trim(), targetId, color);
      setName("");
      setNameManuallyEdited(false);
      setTargetId("");
      setColor("blue");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("toasts.createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      setName("");
      setNameManuallyEdited(false);
      setTargetId("");
      setColor("blue");
      setError(null);
    }
    onOpenChange(open);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("create.title")}</DialogTitle>
            <DialogDescription>
              {t("create.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Target drawing — first */}
            <div className="space-y-2">
              <Label>{t("create.targetLabel")}</Label>
              <Select value={targetId} onValueChange={handleTargetChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("create.targetPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availableDrawings.length === 0 ? (
                    <div className="px-2 py-4 text-sm text-muted-foreground text-center">
                      {t("create.noTargets")}
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

            {/* Marker name — auto-filled from target, editable */}
            <div className="space-y-2">
              <Label htmlFor="marker-name">{t("create.nameLabel")}</Label>
              <Input
                id="marker-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t("create.namePlaceholder")}
                maxLength={50}
              />
              <p className="text-xs text-muted-foreground">
                {t("create.charCount", { count: name.length })}
              </p>
            </div>

            {/* Color picker */}
            <div className="space-y-2">
              <Label>{t("create.colorLabel")}</Label>
              <div className="flex items-center gap-2">
                {MARKER_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      color === c
                        ? "border-foreground scale-110"
                        : "border-transparent hover:border-muted-foreground/50"
                    }`}
                    style={{ backgroundColor: MARKER_COLOR_MAP[c] }}
                    aria-label={c}
                  />
                ))}
              </div>
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
              {tc("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !targetId || submitting}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("create.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Check, FolderOpen, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DrawingGroup } from "@/lib/types/drawing";

interface AssignGroupSelectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: DrawingGroup[];
  currentGroupId: string | null;
  onAssign: (groupId: string | null) => Promise<void>;
}

const NONE = "__none__";

export function AssignGroupSelect({
  open,
  onOpenChange,
  groups,
  currentGroupId,
  onAssign,
}: AssignGroupSelectProps) {
  const [pending, setPending] = useState<string>(currentGroupId ?? NONE);
  const [saving, setSaving] = useState(false);

  // Reset local selection every time the dialog re-opens for a new drawing.
  useEffect(() => {
    if (open) setPending(currentGroupId ?? NONE);
  }, [open, currentGroupId]);

  const pendingGroupId = pending === NONE ? null : pending;
  const isDirty = pendingGroupId !== currentGroupId;

  async function handleSave() {
    if (!isDirty || saving) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await onAssign(pendingGroupId);
      onOpenChange(false);
    } catch {
      // Error surfaced by caller via toast; keep dialog open so user can retry.
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
          <DialogTitle>Gruppe zuweisen</DialogTitle>
          <DialogDescription>
            Wähle eine Gruppe für diese Zeichnung und bestätige mit „Speichern".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1 py-2">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left transition-colors",
                "hover:bg-accent hover:text-accent-foreground",
                pending === group.id && "bg-accent"
              )}
              onClick={() => setPending(group.id)}
              disabled={saving}
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{group.name}</span>
              {pending === group.id && (
                <Check className="h-4 w-4 shrink-0 text-primary" />
              )}
            </button>
          ))}

          <div className="border-t my-2" />

          <button
            type="button"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-left transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              pending === NONE && "bg-accent"
            )}
            onClick={() => setPending(NONE)}
            disabled={saving}
          >
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Ohne Gruppe</span>
            {pending === NONE && (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            )}
          </button>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={saving || !isDirty}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

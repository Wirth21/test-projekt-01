"use client";

import { useState } from "react";
import { Check, FolderOpen } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { DrawingGroup } from "@/lib/types/drawing";

interface AssignGroupSelectProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: DrawingGroup[];
  currentGroupId: string | null;
  onAssign: (groupId: string | null) => Promise<void>;
}

export function AssignGroupSelect({
  open,
  onOpenChange,
  groups,
  currentGroupId,
  onAssign,
}: AssignGroupSelectProps) {
  const [assigning, setAssigning] = useState<string | null>(null);

  async function handleSelect(groupId: string | null) {
    if (groupId === currentGroupId) {
      onOpenChange(false);
      return;
    }

    setAssigning(groupId ?? "__none__");
    try {
      await onAssign(groupId);
      onOpenChange(false);
    } catch {
      // Error handled by caller via toast
    } finally {
      setAssigning(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Gruppe zuweisen</DialogTitle>
          <DialogDescription>
            Waehle eine Gruppe fuer diese Zeichnung.
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
                currentGroupId === group.id && "bg-accent",
                assigning === group.id && "opacity-50 pointer-events-none"
              )}
              onClick={() => handleSelect(group.id)}
              disabled={assigning !== null}
            >
              <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{group.name}</span>
              {currentGroupId === group.id && (
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
              currentGroupId === null && "bg-accent",
              assigning === "__none__" && "opacity-50 pointer-events-none"
            )}
            onClick={() => handleSelect(null)}
            disabled={assigning !== null}
          >
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Ohne Gruppe</span>
            {currentGroupId === null && (
              <Check className="h-4 w-4 shrink-0 text-primary" />
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Pencil, Link2, Trash2, Loader2 } from "lucide-react";
import type { MarkerWithTarget } from "@/lib/types/marker";
import type { Drawing } from "@/lib/types/drawing";
import { useTranslations } from "next-intl";

interface MarkerContextMenuProps {
  marker: MarkerWithTarget;
  position: { x: number; y: number };
  drawings: Drawing[];
  currentDrawingId: string;
  onRename: (markerId: string, name: string) => Promise<void>;
  onChangeTarget: (markerId: string, targetId: string) => Promise<void>;
  onDelete: (markerId: string) => Promise<void>;
  onClose: () => void;
}

export function MarkerContextMenu({
  marker,
  position,
  drawings,
  currentDrawingId,
  onRename,
  onChangeTarget,
  onDelete,
  onClose,
}: MarkerContextMenuProps) {
  const t = useTranslations("markers");
  const tc = useTranslations("common");
  const ref = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"menu" | "rename" | "retarget">("menu");
  const [renameValue, setRenameValue] = useState(marker.name);
  const [newTargetId, setNewTargetId] = useState(
    marker.target_drawing_id
  );
  const [loading, setLoading] = useState(false);

  const availableDrawings = drawings.filter(
    (d) => d.id !== currentDrawingId && !d.is_archived
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  async function handleRename() {
    if (!renameValue.trim() || renameValue.trim() === marker.name) {
      onClose();
      return;
    }
    setLoading(true);
    try {
      await onRename(marker.id, renameValue.trim());
      onClose();
    } catch {
      setLoading(false);
    }
  }

  async function handleRetarget() {
    if (newTargetId === marker.target_drawing_id) {
      onClose();
      return;
    }
    setLoading(true);
    try {
      await onChangeTarget(marker.id, newTargetId);
      onClose();
    } catch {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      await onDelete(marker.id);
      onClose();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] bg-popover text-popover-foreground border rounded-lg shadow-lg p-1"
      style={{ left: position.x, top: position.y }}
    >
      {mode === "menu" && (
        <>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
            onClick={() => setMode("rename")}
          >
            <Pencil className="h-3.5 w-3.5" />
            {t("context.rename")}
          </button>
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
            onClick={() => setMode("retarget")}
          >
            <Link2 className="h-3.5 w-3.5" />
            {t("context.changeTarget")}
          </button>
          <div className="my-1 border-t" />
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-destructive/10 text-destructive transition-colors text-left"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            {tc("delete")}
          </button>
        </>
      )}

      {mode === "rename" && (
        <div className="p-2 space-y-2">
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            maxLength={50}
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleRename();
              if (e.key === "Escape") onClose();
            }}
          />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleRename}
              disabled={!renameValue.trim() || loading}
            >
              {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {tc("save")}
            </Button>
          </div>
        </div>
      )}

      {mode === "retarget" && (
        <div className="p-2 space-y-2">
          <Select value={newTargetId} onValueChange={setNewTargetId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableDrawings.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button
              size="sm"
              onClick={handleRetarget}
              disabled={newTargetId === marker.target_drawing_id || loading}
            >
              {loading && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {tc("save")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

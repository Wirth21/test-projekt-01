"use client";

import { useState } from "react";
import {
  MoreVertical,
  Pencil,
  Archive,
  CircleDot,
  Calendar,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenameVersionDialog } from "@/components/drawings/RenameVersionDialog";
import { ArchiveVersionDialog } from "@/components/drawings/ArchiveVersionDialog";
import { EditVersionDateDialog } from "@/components/drawings/EditVersionDateDialog";
import type { DrawingVersion, DrawingStatus } from "@/lib/types/drawing";

interface VersionItemProps {
  version: DrawingVersion;
  isActive: boolean;
  isLatest: boolean;
  canArchive: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onSelect: (versionId: string) => void;
  onRename: (versionId: string, label: string) => Promise<void>;
  onArchive: (versionId: string) => Promise<void>;
  onUpdateDate?: (versionId: string, isoDate: string) => Promise<void>;
  onMove?: (versionId: string, direction: "up" | "down") => Promise<void>;
  statusId?: string | null;
  statuses?: DrawingStatus[];
  onStatusChange?: (statusId: string | null) => Promise<void>;
  /** When false, all write controls (move/rename/archive/status/date) are hidden. */
  canEdit?: boolean;
}

export function VersionItem({
  version,
  isActive,
  isLatest,
  canArchive,
  canMoveUp = false,
  canMoveDown = false,
  onSelect,
  onRename,
  onArchive,
  onUpdateDate,
  onMove,
  statusId,
  statuses,
  onStatusChange,
  canEdit = true,
}: VersionItemProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  const formattedDate = new Date(version.created_at).toLocaleDateString(
    "de-DE",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(version.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(version.id);
          }
        }}
        className={`w-full text-left px-3 py-2.5 rounded-md transition-colors cursor-pointer ${
          version.is_archived
            ? "opacity-50"
            : ""
        } ${
          isActive
            ? "bg-primary/10 border border-primary/20"
            : "hover:bg-muted border border-transparent"
        }`}
        aria-label={`Version v${version.version_number} auswaehlen`}
        aria-current={isActive ? "true" : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">
                v{version.version_number}
              </span>
              {isLatest && !version.is_archived && (
                <Badge variant="default" className="text-[10px] h-4 px-1">
                  Aktuell
                </Badge>
              )}
              {version.is_archived && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  Archiviert
                </Badge>
              )}
              {isActive && (
                <div className="h-2 w-2 rounded-full bg-primary shrink-0" aria-label="Aktuell angezeigt" />
              )}
              {statusId && statuses && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-medium leading-none rounded-full border px-1.5 py-0.5"
                  style={{ borderColor: statuses.find((s) => s.id === statusId)?.color ?? "#888" }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: statuses.find((s) => s.id === statusId)?.color ?? "#888" }}
                    aria-hidden="true"
                  />
                  {statuses.find((s) => s.id === statusId)?.name ?? ""}
                </span>
              )}
            </div>
            <p className="text-sm font-medium truncate mt-0.5">
              {version.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formattedDate}
            </p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            {canEdit && onMove && !version.is_archived && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onMove(version.id, "up");
                  }}
                  disabled={!canMoveUp}
                  aria-label="Nach oben verschieben"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    void onMove(version.id, "down");
                  }}
                  disabled={!canMoveDown}
                  aria-label="Nach unten verschieben"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
            {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 shrink-0"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Versionsaktionen"
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenameOpen(true);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Label umbenennen
                </DropdownMenuItem>
                {onUpdateDate && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setDateOpen(true);
                    }}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Datum ändern
                  </DropdownMenuItem>
                )}
              {statuses && statuses.length > 0 && onStatusChange && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger onClick={(e) => e.stopPropagation()}>
                      <CircleDot className="mr-2 h-4 w-4" />
                      Status
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          onStatusChange(null);
                        }}
                      >
                        <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0 mr-2 border border-muted-foreground/30" />
                        <span className="text-muted-foreground">Kein Status</span>
                        {!statusId && (
                          <span className="ml-auto text-xs text-muted-foreground">✓</span>
                        )}
                      </DropdownMenuItem>
                      {statuses
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((status) => (
                          <DropdownMenuItem
                            key={status.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onStatusChange(status.id);
                            }}
                          >
                            <span
                              className="inline-block h-2.5 w-2.5 rounded-full shrink-0 mr-2"
                              style={{ backgroundColor: status.color }}
                            />
                            {status.name}
                            {statusId === status.id && (
                              <span className="ml-auto text-xs text-muted-foreground">✓</span>
                            )}
                          </DropdownMenuItem>
                        ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              {!version.is_archived && canArchive && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setArchiveOpen(true);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archivieren
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
            )}
        </div>
        </div>
      </div>

      <RenameVersionDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentLabel={version.label}
        versionNumber={version.version_number}
        onSubmit={(label) => onRename(version.id, label)}
      />

      <ArchiveVersionDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        versionLabel={version.label}
        versionNumber={version.version_number}
        onConfirm={() => onArchive(version.id)}
      />

      {onUpdateDate && (
        <EditVersionDateDialog
          open={dateOpen}
          onOpenChange={setDateOpen}
          versionNumber={version.version_number}
          currentDate={version.created_at}
          onSubmit={(isoDate) => onUpdateDate(version.id, isoDate)}
        />
      )}
    </>
  );
}

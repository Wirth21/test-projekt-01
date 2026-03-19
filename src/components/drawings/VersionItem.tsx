"use client";

import { useState } from "react";
import { MoreVertical, Pencil, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RenameVersionDialog } from "@/components/drawings/RenameVersionDialog";
import { ArchiveVersionDialog } from "@/components/drawings/ArchiveVersionDialog";
import type { DrawingVersion } from "@/lib/types/drawing";

interface VersionItemProps {
  version: DrawingVersion;
  isActive: boolean;
  isLatest: boolean;
  canArchive: boolean;
  onSelect: (versionId: string) => void;
  onRename: (versionId: string, label: string) => Promise<void>;
  onArchive: (versionId: string) => Promise<void>;
}

export function VersionItem({
  version,
  isActive,
  isLatest,
  canArchive,
  onSelect,
  onRename,
  onArchive,
}: VersionItemProps) {
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

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
      <button
        type="button"
        onClick={() => onSelect(version.id)}
        className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${
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
            <div className="flex items-center gap-1.5">
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
            </div>
            <p className="text-sm font-medium truncate mt-0.5">
              {version.label}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formattedDate}
            </p>
          </div>

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
        </div>
      </button>

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
    </>
  );
}

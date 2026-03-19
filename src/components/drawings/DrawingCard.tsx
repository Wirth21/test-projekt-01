"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Pencil, Archive, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PdfThumbnail } from "@/components/drawings/PdfThumbnail";
import { RenameDrawingDialog } from "@/components/drawings/RenameDrawingDialog";
import { ArchiveDrawingDialog } from "@/components/drawings/ArchiveDrawingDialog";
import { AssignGroupSelect } from "@/components/drawings/AssignGroupSelect";
import type { Drawing, DrawingGroup } from "@/lib/types/drawing";

interface DrawingCardProps {
  drawing: Drawing;
  projectId: string;
  thumbnailUrl: string | null;
  onRename: (drawingId: string, displayName: string) => Promise<void>;
  onArchive: (drawingId: string) => Promise<void>;
  groups?: DrawingGroup[];
  onAssignGroup?: (drawingId: string, groupId: string | null) => Promise<void>;
  /** Number of versions for this drawing (shows badge when > 1) */
  versionCount?: number;
}

export function DrawingCard({
  drawing,
  projectId,
  thumbnailUrl,
  onRename,
  onArchive,
  groups,
  onAssignGroup,
  versionCount,
}: DrawingCardProps) {
  const router = useRouter();
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [assignGroupOpen, setAssignGroupOpen] = useState(false);

  const formattedDate = new Date(drawing.created_at).toLocaleDateString(
    "de-DE",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  );

  function handleCardClick() {
    router.push(
      `/dashboard/projects/${projectId}/drawings/${drawing.id}`
    );
  }

  return (
    <>
      <div
        className="group rounded-lg border bg-card overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        aria-label={`Zeichnung ${drawing.display_name} oeffnen`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        {/* Thumbnail */}
        <div className="aspect-[3/2] bg-muted flex items-center justify-center overflow-hidden relative">
          {thumbnailUrl ? (
            <PdfThumbnail url={thumbnailUrl} width={200} />
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <div className="h-10 w-10 text-muted-foreground/40">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-full w-full"
                >
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                </svg>
              </div>
            </div>
          )}
          {versionCount != null && versionCount > 1 && (
            <Badge
              variant="secondary"
              className="absolute top-2 right-2 text-[10px] h-5 px-1.5 font-mono"
            >
              v{versionCount}
            </Badge>
          )}
        </div>

        {/* Info */}
        <div className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">
                {drawing.display_name}
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
                  className="h-7 w-7 p-0"
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Aktionen"
                >
                  <MoreVertical className="h-4 w-4" />
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
                  Umbenennen
                </DropdownMenuItem>
                {groups && groups.length > 0 && onAssignGroup && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        setAssignGroupOpen(true);
                      }}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
                      Gruppe zuweisen
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
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
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <RenameDrawingDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        currentName={drawing.display_name}
        onSubmit={(displayName) => onRename(drawing.id, displayName)}
      />

      <ArchiveDrawingDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        drawingName={drawing.display_name}
        onConfirm={() => onArchive(drawing.id)}
      />

      {groups && onAssignGroup && (
        <AssignGroupSelect
          open={assignGroupOpen}
          onOpenChange={setAssignGroupOpen}
          groups={groups}
          currentGroupId={drawing.group_id}
          onAssign={(groupId) => onAssignGroup(drawing.id, groupId)}
        />
      )}
    </>
  );
}

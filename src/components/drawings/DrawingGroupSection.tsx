"use client";

import { useState } from "react";
import { ChevronRight, MoreVertical, Pencil, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DrawingGrid } from "@/components/drawings/DrawingGrid";
import { RenameGroupDialog } from "@/components/drawings/RenameGroupDialog";
import { ArchiveGroupDialog } from "@/components/drawings/ArchiveGroupDialog";
import type { Drawing, DrawingGroup, DrawingStatus } from "@/lib/types/drawing";

interface DrawingGroupSectionProps {
  group: DrawingGroup | null; // null = "Ohne Gruppe"
  drawings: Drawing[];
  allGroups: DrawingGroup[];
  projectId: string;
  legacyPdfUrls: Map<string, string>;
  onRenameDrawing: (drawingId: string, displayName: string) => Promise<void>;
  onArchiveDrawing: (drawingId: string) => Promise<void>;
  onRenameGroup?: (groupId: string, name: string) => Promise<void>;
  onArchiveGroup?: (groupId: string) => Promise<void>;
  onAssignGroup: (drawingId: string, groupId: string | null) => Promise<void>;
  existingGroupNames: string[];
  defaultOpen?: boolean;
  versionCounts?: Map<string, number>;
  statuses?: DrawingStatus[];
  onStatusChange?: (drawingId: string, versionId: string, statusId: string | null) => Promise<void>;
}

export function DrawingGroupSection({
  group,
  drawings,
  allGroups,
  projectId,
  legacyPdfUrls,
  onRenameDrawing,
  onArchiveDrawing,
  onRenameGroup,
  onArchiveGroup,
  onAssignGroup,
  existingGroupNames,
  defaultOpen = true,
  versionCounts,
  statuses,
  onStatusChange,
}: DrawingGroupSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [renameOpen, setRenameOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const isUngrouped = group === null;
  const title = isUngrouped ? "Ohne Gruppe" : group.name;
  const activeDrawingCount = drawings.length;

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 py-2 px-1 rounded-md hover:bg-accent transition-colors text-left flex-1 min-w-0"
              aria-label={`${title} ${isOpen ? "zuklappen" : "aufklappen"}`}
            >
              <ChevronRight
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  isOpen ? "rotate-90" : ""
                }`}
              />
              <span className="text-sm font-semibold truncate">{title}</span>
              <Badge variant="secondary" className="ml-1 shrink-0">
                {activeDrawingCount}
              </Badge>
            </button>
          </CollapsibleTrigger>

          {!isUngrouped && onRenameGroup && onArchiveGroup && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0"
                  aria-label={`Aktionen für Gruppe ${title}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setRenameOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Umbenennen
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setArchiveOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Archive className="mr-2 h-4 w-4" />
                  Archivieren
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <CollapsibleContent>
          <div className="pl-2 sm:pl-6 pt-2 pb-4">
            <DrawingGrid
              drawings={drawings}
              projectId={projectId}
              legacyPdfUrls={legacyPdfUrls}
              onRename={onRenameDrawing}
              onArchive={onArchiveDrawing}
              groups={allGroups}
              onAssignGroup={onAssignGroup}
              versionCounts={versionCounts}
              statuses={statuses}
              onStatusChange={onStatusChange}
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {!isUngrouped && group && onRenameGroup && (
        <RenameGroupDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          currentName={group.name}
          onSubmit={(name) => onRenameGroup(group.id, name)}
          existingNames={existingGroupNames}
        />
      )}

      {!isUngrouped && group && onArchiveGroup && (
        <ArchiveGroupDialog
          open={archiveOpen}
          onOpenChange={setArchiveOpen}
          groupName={group.name}
          activeDrawingCount={activeDrawingCount}
          onConfirm={() => onArchiveGroup(group.id)}
        />
      )}
    </>
  );
}

"use client";

import { useMemo } from "react";
import { FileText } from "lucide-react";
import { DrawingGroupSection } from "@/components/drawings/DrawingGroupSection";
import type { Drawing, DrawingGroup, DrawingStatus } from "@/lib/types/drawing";

interface GroupedDrawingListProps {
  drawings: Drawing[];
  groups: DrawingGroup[];
  projectId: string;
  thumbnailUrls: Map<string, string>;
  onRenameDrawing: (drawingId: string, displayName: string) => Promise<void>;
  onArchiveDrawing: (drawingId: string) => Promise<void>;
  onRenameGroup: (groupId: string, name: string) => Promise<void>;
  onArchiveGroup: (groupId: string) => Promise<void>;
  onAssignGroup: (drawingId: string, groupId: string | null) => Promise<void>;
  /** Map of drawingId -> version count (for version badge on cards) */
  versionCounts?: Map<string, number>;
  statuses?: DrawingStatus[];
  onStatusChange?: (drawingId: string, versionId: string, statusId: string | null) => Promise<void>;
}

export function GroupedDrawingList({
  drawings,
  groups,
  projectId,
  thumbnailUrls,
  onRenameDrawing,
  onArchiveDrawing,
  onRenameGroup,
  onArchiveGroup,
  onAssignGroup,
  versionCounts,
  statuses,
  onStatusChange,
}: GroupedDrawingListProps) {
  // Active (non-archived) groups sorted by creation date (oldest first)
  const activeGroups = useMemo(
    () =>
      groups
        .filter((g) => !g.is_archived)
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        ),
    [groups]
  );

  // Group drawings by group_id
  const groupedDrawings = useMemo(() => {
    const map = new Map<string | null, Drawing[]>();

    // Initialize all active groups (even empty ones)
    for (const group of activeGroups) {
      map.set(group.id, []);
    }
    map.set(null, []);

    for (const drawing of drawings) {
      const key = drawing.group_id;
      // If a drawing points to an archived/unknown group, put it in ungrouped
      if (key && map.has(key)) {
        map.get(key)!.push(drawing);
      } else {
        map.get(null)!.push(drawing);
      }
    }

    return map;
  }, [drawings, activeGroups]);

  const ungroupedDrawings = groupedDrawings.get(null) ?? [];
  const existingGroupNames = activeGroups.map((g) => g.name);

  // If there are no groups and no drawings, show empty state
  if (activeGroups.length === 0 && drawings.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 flex flex-col items-center justify-center py-16 text-center">
        <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium">Noch keine Zeichnungen</p>
        <p className="text-xs text-muted-foreground mt-1">
          Lade eine PDF hoch, um zu beginnen
        </p>
      </div>
    );
  }

  // If no groups exist, just show ungrouped drawings without the "Ohne Gruppe" header
  if (activeGroups.length === 0) {
    return (
      <DrawingGroupSection
        group={null}
        drawings={ungroupedDrawings}
        allGroups={activeGroups}
        projectId={projectId}
        thumbnailUrls={thumbnailUrls}
        onRenameDrawing={onRenameDrawing}
        onArchiveDrawing={onArchiveDrawing}
        onAssignGroup={onAssignGroup}
        existingGroupNames={existingGroupNames}
        versionCounts={versionCounts}
        statuses={statuses}
        onStatusChange={onStatusChange}
      />
    );
  }

  return (
    <div className="space-y-2">
      {/* Named groups sorted by creation date */}
      {activeGroups.map((group) => (
        <DrawingGroupSection
          key={group.id}
          group={group}
          drawings={groupedDrawings.get(group.id) ?? []}
          allGroups={activeGroups}
          projectId={projectId}
          thumbnailUrls={thumbnailUrls}
          onRenameDrawing={onRenameDrawing}
          onArchiveDrawing={onArchiveDrawing}
          onRenameGroup={onRenameGroup}
          onArchiveGroup={onArchiveGroup}
          onAssignGroup={onAssignGroup}
          existingGroupNames={existingGroupNames}
          versionCounts={versionCounts}
          statuses={statuses}
          onStatusChange={onStatusChange}
        />
      ))}

      {/* "Ohne Gruppe" section — only if ungrouped drawings exist */}
      {ungroupedDrawings.length > 0 && (
        <DrawingGroupSection
          group={null}
          drawings={ungroupedDrawings}
          allGroups={activeGroups}
          projectId={projectId}
          thumbnailUrls={thumbnailUrls}
          onRenameDrawing={onRenameDrawing}
          onArchiveDrawing={onArchiveDrawing}
          onAssignGroup={onAssignGroup}
          existingGroupNames={existingGroupNames}
          versionCounts={versionCounts}
          statuses={statuses}
          onStatusChange={onStatusChange}
        />
      )}
    </div>
  );
}

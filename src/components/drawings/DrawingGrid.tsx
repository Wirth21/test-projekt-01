"use client";

import { FileText } from "lucide-react";
import { DrawingCard } from "@/components/drawings/DrawingCard";
import type { Drawing, DrawingGroup, DrawingStatus } from "@/lib/types/drawing";

interface DrawingGridProps {
  drawings: Drawing[];
  projectId: string;
  thumbnailUrls: Map<string, string>;
  onRename: (drawingId: string, displayName: string) => Promise<void>;
  onArchive: (drawingId: string) => Promise<void>;
  groups?: DrawingGroup[];
  onAssignGroup?: (drawingId: string, groupId: string | null) => Promise<void>;
  /** Map of drawingId -> version count (for version badge) */
  versionCounts?: Map<string, number>;
  statuses?: DrawingStatus[];
  onStatusChange?: (drawingId: string, versionId: string, statusId: string | null) => Promise<void>;
}

export function DrawingGrid({
  drawings,
  projectId,
  thumbnailUrls,
  onRename,
  onArchive,
  groups,
  onAssignGroup,
  versionCounts,
  statuses,
  onStatusChange,
}: DrawingGridProps) {
  if (drawings.length === 0) {
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

  return (
    <div className="grid grid-cols-2 min-[400px]:grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2.5">
      {drawings.map((drawing) => (
        <DrawingCard
          key={drawing.id}
          drawing={drawing}
          projectId={projectId}
          thumbnailUrl={thumbnailUrls.get(drawing.id) ?? null}
          onRename={onRename}
          onArchive={onArchive}
          groups={groups}
          onAssignGroup={onAssignGroup}
          versionCount={versionCounts?.get(drawing.id)}
          statuses={statuses}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  );
}

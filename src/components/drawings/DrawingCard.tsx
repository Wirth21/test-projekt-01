"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { MoreVertical, Pencil, Archive, FolderOpen, CircleDot } from "lucide-react";
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

const PdfThumbnail = dynamic(
  () => import("@/components/drawings/PdfThumbnail").then((m) => m.PdfThumbnail),
  { ssr: false }
);
import { RenameDrawingDialog } from "@/components/drawings/RenameDrawingDialog";
import { ArchiveDrawingDialog } from "@/components/drawings/ArchiveDrawingDialog";
import { AssignGroupSelect } from "@/components/drawings/AssignGroupSelect";
import type { Drawing, DrawingGroup, DrawingStatus } from "@/lib/types/drawing";

interface DrawingCardProps {
  drawing: Drawing;
  projectId: string;
  /** Signed URL for the raw PDF, used only as a fallback when the drawing
   *  has no server-side thumbnail yet (legacy uploads). */
  legacyPdfUrl: string | null;
  onRename: (drawingId: string, displayName: string) => Promise<void>;
  onArchive: (drawingId: string) => Promise<void>;
  groups?: DrawingGroup[];
  onAssignGroup?: (drawingId: string, groupId: string | null) => Promise<void>;
  /** Number of versions for this drawing (shows badge when > 1) */
  versionCount?: number;
  statuses?: DrawingStatus[];
  onStatusChange?: (drawingId: string, versionId: string, statusId: string | null) => Promise<void>;
}

export function DrawingCard({
  drawing,
  projectId,
  legacyPdfUrl,
  onRename,
  onArchive,
  groups,
  onAssignGroup,
  versionCount,
  statuses,
  onStatusChange,
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
        aria-label={`Zeichnung ${drawing.display_name} öffnen`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        {/* Thumbnail */}
        <div className="aspect-[3/2] bg-muted flex items-center justify-center overflow-hidden relative">
          {drawing.thumbnail_url ? (
            // Modern path: pre-rendered JPEG is served directly — no PDF.js
            // load, no per-mount work, just a tiny image.
            // eslint-disable-next-line @next/next/no-img-element -- signed URL from Supabase Storage, not a static asset
            <img
              src={drawing.thumbnail_url}
              alt={`Vorschau ${drawing.display_name}`}
              className="w-full h-full object-contain p-2"
              loading="lazy"
              decoding="async"
            />
          ) : legacyPdfUrl ? (
            // Legacy drawings uploaded before server-side thumbnails existed:
            // fall back to in-browser PDF rendering + IndexedDB cache.
            <PdfThumbnail
              url={legacyPdfUrl}
              width={600}
              cacheKey={`thumb:${drawing.id}`}
              drawingId={drawing.id}
              versionId={drawing.latest_version?.id ?? null}
              projectId={projectId}
              pdfStoragePath={drawing.latest_version?.storage_path ?? null}
            />
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
              {drawing.latest_version?.status && (
                <span
                  className="inline-flex items-center gap-1 mt-1 text-[10px] font-medium leading-none rounded-full border px-1.5 py-0.5"
                  style={{ borderColor: drawing.latest_version.status.color }}
                >
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: drawing.latest_version.status.color }}
                    aria-hidden="true"
                  />
                  {drawing.latest_version.status.name}
                </span>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 transition-opacity"
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
                {statuses && statuses.length > 0 && onStatusChange && drawing.latest_version && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CircleDot className="mr-2 h-4 w-4" />
                        Status
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusChange(drawing.id, drawing.latest_version!.id, null);
                          }}
                        >
                          <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0 mr-2 border border-muted-foreground/30" />
                          <span className="text-muted-foreground">Kein Status</span>
                          {!drawing.latest_version?.status_id && (
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
                                onStatusChange(drawing.id, drawing.latest_version!.id, status.id);
                              }}
                            >
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full shrink-0 mr-2"
                                style={{ backgroundColor: status.color }}
                              />
                              {status.name}
                              {drawing.latest_version?.status_id === status.id && (
                                <span className="ml-auto text-xs text-muted-foreground">✓</span>
                              )}
                            </DropdownMenuItem>
                          ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
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

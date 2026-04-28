"use client";

import { useState } from "react";
import { History, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";


import { VersionItem } from "@/components/drawings/VersionItem";
import { VersionUploadDialog } from "@/components/drawings/VersionUploadDialog";
import type { DrawingVersion, DrawingStatus } from "@/lib/types/drawing";

interface VersionSidePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: DrawingVersion[];
  loading: boolean;
  activeVersionId: string | null;
  drawingName: string;
  onSelectVersion: (versionId: string) => void;
  onUploadVersion: (file: File, onProgress: (pct: number) => void) => Promise<void>;
  onRenameVersion: (versionId: string, label: string) => Promise<void>;
  onArchiveVersion: (versionId: string) => Promise<void>;
  /** Edit version date (PATCH created_at) */
  onUpdateDate?: (versionId: string, isoDate: string) => Promise<void>;
  /** Move a version up (higher version_number) or down in the stack */
  onMoveVersion?: (versionId: string, direction: "up" | "down") => Promise<void>;
  /** Available statuses for the tenant */
  statuses?: DrawingStatus[];
  /** Called when the user changes a version's status */
  onStatusChange?: (versionId: string, statusId: string | null) => Promise<void>;
}

export function VersionSidePanel({
  open,
  onOpenChange,
  versions,
  loading,
  activeVersionId,
  drawingName,
  onSelectVersion,
  onUploadVersion,
  onRenameVersion,
  onArchiveVersion,
  onUpdateDate,
  onMoveVersion,
  statuses: availableStatuses,
  onStatusChange,
}: VersionSidePanelProps) {
  const [showArchived, setShowArchived] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const activeVersions = versions.filter((v) => !v.is_archived);
  const archivedVersions = versions.filter((v) => v.is_archived);

  // The top of the stack (highest version_number) is always "the current".
  const latestVersion = [...activeVersions].sort(
    (a, b) => b.version_number - a.version_number
  )[0];

  // Can archive = more than 1 non-archived version
  const canArchive = activeVersions.length > 1;

  // Stack order: highest version_number at the top. Archived appended below.
  function byVersion(a: DrawingVersion, b: DrawingVersion) {
    return b.version_number - a.version_number;
  }

  const sortedActive = [...activeVersions].sort(byVersion);

  const displayedVersions = [
    ...sortedActive,
    ...(showArchived ? [...archivedVersions].sort(byVersion) : []),
  ];

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-[320px] sm:w-[360px] p-0 flex flex-col">
          <SheetHeader className="px-4 pt-4 pb-3 shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4" />
              Versionen
            </SheetTitle>
            <SheetDescription className="sr-only">
              Versionsliste der Zeichnung. Hier kannst du Versionen hochladen,
              umbenennen, archivieren oder umsortieren.
            </SheetDescription>
          </SheetHeader>

          <div className="px-4 pb-3 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Neue Version hochladen
            </Button>
          </div>

          <Separator />

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : versions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-4 text-center">
              <History className="h-8 w-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                Keine Versionen vorhanden
              </p>
            </div>
          ) : (
            <ScrollArea className="flex-1">
              <div className="px-3 py-2 space-y-1">
                {displayedVersions.map((version) => {
                  const activeIdx = sortedActive.findIndex((v) => v.id === version.id);
                  const canMoveUp = activeIdx > 0;
                  const canMoveDown =
                    activeIdx !== -1 && activeIdx < sortedActive.length - 1;
                  return (
                    <VersionItem
                      key={version.id}
                      version={version}
                      isActive={version.id === activeVersionId}
                      isLatest={latestVersion?.id === version.id}
                      canArchive={canArchive}
                      canMoveUp={canMoveUp}
                      canMoveDown={canMoveDown}
                      onSelect={onSelectVersion}
                      onRename={onRenameVersion}
                      onArchive={onArchiveVersion}
                      onUpdateDate={onUpdateDate}
                      onMove={onMoveVersion}
                      statusId={version.status_id}
                      statuses={availableStatuses}
                      onStatusChange={
                        onStatusChange
                          ? (statusId) => onStatusChange(version.id, statusId)
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </ScrollArea>
          )}

          {archivedVersions.length > 0 && (
            <>
              <Separator />
              <div className="px-4 py-3 shrink-0">
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="show-archived-versions"
                    className="text-xs text-muted-foreground cursor-pointer"
                  >
                    Archivierte anzeigen ({archivedVersions.length})
                  </Label>
                  <Switch
                    id="show-archived-versions"
                    checked={showArchived}
                    onCheckedChange={setShowArchived}
                    aria-label="Archivierte Versionen ein-/ausblenden"
                  />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <VersionUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        drawingName={drawingName}
        onUpload={onUploadVersion}
      />
    </>
  );
}

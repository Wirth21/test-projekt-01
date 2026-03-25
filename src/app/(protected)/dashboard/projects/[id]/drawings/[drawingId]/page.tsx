"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  TransformWrapper,
  TransformComponent,
} from "react-zoom-pan-pinch";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Loader2,
  FileWarning,
  Pencil,
  Eye,
  Archive,
  History,
  Maximize,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useDrawings } from "@/hooks/use-drawings";
import { useMarkers } from "@/hooks/use-markers";
import { useVersions } from "@/hooks/use-versions";
import { MarkerOverlay } from "@/components/drawings/MarkerOverlay";
import { MarkerCreationDialog } from "@/components/drawings/MarkerCreationDialog";
import {
  NavigationBreadcrumb,
  type NavHistoryEntry,
} from "@/components/drawings/NavigationBreadcrumb";
import { VersionSidePanel } from "@/components/drawings/VersionSidePanel";
import { FloatingToolbar } from "@/components/drawings/FloatingToolbar";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { UploadInfo } from "@/components/drawings/UploadInfo";
import type { MarkerWithTarget } from "@/lib/types/marker";
import { useTranslations } from "next-intl";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PageProps {
  params: Promise<{ id: string; drawingId: string }>;
}

export default function DrawingViewerPage({ params }: PageProps) {
  const { id: projectId, drawingId: initialDrawingId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("drawings");
  const tm = useTranslations("markers");
  const tc = useTranslations("common");
  const initialVersionId = searchParams.get("versionId");

  const {
    drawings,
    loading: drawingsLoading,
    getSignedUrl,
  } = useDrawings(projectId);

  // Current drawing can change when navigating via markers
  const [activeDrawingId, setActiveDrawingId] = useState(initialDrawingId);

  const {
    versions,
    loading: versionsLoading,
    latestActiveVersion,
    uploadVersion,
    renameVersion,
    archiveVersion,
    getVersionSignedUrl,
    refetch: refetchVersions,
  } = useVersions(projectId, activeDrawingId);

  // Active version: from URL param, or latest active version
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    initialVersionId
  );

  // Determine the actual version to display
  const activeVersion =
    versions.find((v) => v.id === selectedVersionId) ?? latestActiveVersion;

  const {
    markers,
    loading: markersLoading,
    createMarker,
    updateMarker,
    deleteMarker,
  } = useMarkers(projectId, activeDrawingId, activeVersion?.id);

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);

  // Version panel state
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);

  // Marker state
  const [editMode, setEditMode] = useState(false);
  const [creationPos, setCreationPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [navHistory, setNavHistory] = useState<NavHistoryEntry[]>([]);

  const pageContainerRef = useRef<HTMLDivElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const { isFullscreen, isSupported: fullscreenSupported, toggleFullscreen, exitFullscreen: exitFs } = useFullscreen(viewerContainerRef);

  const drawing = drawings.find((d) => d.id === activeDrawingId);

  // When versions load and no version is selected yet, select the latest
  useEffect(() => {
    if (!versionsLoading && versions.length > 0 && !selectedVersionId) {
      if (latestActiveVersion) {
        setSelectedVersionId(latestActiveVersion.id);
      }
    }
  }, [versionsLoading, versions, selectedVersionId, latestActiveVersion]);

  // Fetch signed URL for the active version
  const fetchUrl = useCallback(async () => {
    if (!activeVersion) return;

    setUrlLoading(true);
    setUrlError(null);
    setPdfLoading(true);
    setPdfError(false);
    try {
      const url = await getVersionSignedUrl(activeVersion.id);
      setPdfUrl(url);
    } catch (err) {
      setUrlError(
        err instanceof Error
          ? err.message
          : t("toasts.pdfUrlFailed")
      );
    } finally {
      setUrlLoading(false);
    }
  }, [activeVersion, getVersionSignedUrl]);

  useEffect(() => {
    if (activeVersion) {
      fetchUrl();
      setCurrentPage(1);
      setNumPages(null);
    }
  }, [activeVersion?.id, fetchUrl]);

  // Update URL query param when version changes (without full navigation)
  useEffect(() => {
    if (activeVersion && activeVersion.id !== initialVersionId) {
      const url = new URL(window.location.href);
      url.searchParams.set("versionId", activeVersion.id);
      window.history.replaceState(null, "", url.toString());
    }
  }, [activeVersion, initialVersionId]);

  function handleDocumentLoadSuccess({
    numPages: pages,
  }: {
    numPages: number;
  }) {
    setNumPages(pages);
    setPdfLoading(false);
  }

  function handleDocumentLoadError() {
    setPdfError(true);
    setPdfLoading(false);
  }

  function goToPreviousPage() {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  }

  function goToNextPage() {
    setCurrentPage((prev) => Math.min(numPages ?? prev, prev + 1));
  }

  // Version handlers
  function handleSelectVersion(versionId: string) {
    setSelectedVersionId(versionId);
  }

  async function handleUploadVersion(
    file: File,
    onProgress: (pct: number) => void
  ) {
    try {
      const result = await uploadVersion(file, onProgress);
      setSelectedVersionId(result.version.id);
      if (result.markerCopyFailed) {
        toast.warning(t("toasts.versionUploadedMarkersWarning"));
      } else if (result.markersCopied > 0) {
        toast.success(t("toasts.versionUploadedWithMarkers", { count: result.markersCopied }));
      } else {
        toast.success(t("toasts.versionUploaded"));
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.uploadFailed")
      );
      throw err;
    }
  }

  async function handleRenameVersion(versionId: string, label: string) {
    try {
      await renameVersion(versionId, label);
      toast.success(t("toasts.versionRenamed"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.renameFailed")
      );
      throw err;
    }
  }

  async function handleArchiveVersion(versionId: string) {
    try {
      await archiveVersion(versionId);
      // If the archived version was the active one, switch to latest
      if (versionId === selectedVersionId) {
        setSelectedVersionId(null);
      }
      toast.success(t("toasts.versionArchived"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : t("toasts.versionArchiveFailed")
      );
      throw err;
    }
  }

  // Marker handlers
  function handlePageClick(xPercent: number, yPercent: number) {
    setCreationPos({ x: xPercent, y: yPercent });
  }

  async function handleCreateMarker(name: string, targetDrawingId: string) {
    if (!creationPos) return;
    await createMarker({
      name,
      target_drawing_id: targetDrawingId,
      page_number: currentPage,
      x_percent: Math.round(creationPos.x * 100) / 100,
      y_percent: Math.round(creationPos.y * 100) / 100,
    });
    toast.success(tm("created"));
  }

  function handleMarkerClick(marker: MarkerWithTarget) {
    if (!marker.target_drawing) {
      toast.error(tm("targetDeletedNavError"));
      return;
    }
    if (marker.target_drawing.is_archived) {
      toast.error(tm("targetArchivedNavError"));
      return;
    }

    // Add current drawing to nav history
    const currentName = drawing?.display_name ?? t("drawing");
    setNavHistory((prev) => [
      ...prev,
      { drawingId: activeDrawingId, drawingName: currentName },
    ]);

    // Navigate to target
    setActiveDrawingId(marker.target_drawing.id);
    setSelectedVersionId(null); // Will resolve to latest version of target
  }

  function handleBreadcrumbNavigate(index: number) {
    const entry = navHistory[index];
    // Trim history to this point
    setNavHistory((prev) => prev.slice(0, index));
    setActiveDrawingId(entry.drawingId);
    setSelectedVersionId(null);
  }

  function handleClearHistory() {
    setNavHistory([]);
  }

  async function handleMarkerRename(markerId: string, name: string) {
    await updateMarker(markerId, { name });
    toast.success(tm("renamed"));
  }

  async function handleMarkerRetarget(markerId: string, targetId: string) {
    await updateMarker(markerId, { target_drawing_id: targetId });
    toast.success(tm("targetChanged"));
  }

  async function handleMarkerDelete(markerId: string) {
    await deleteMarker(markerId);
    toast.success(tm("deleted"));
  }

  async function handleMarkerDrag(
    markerId: string,
    xPercent: number,
    yPercent: number
  ) {
    await updateMarker(markerId, {
      x_percent: Math.round(xPercent * 100) / 100,
      y_percent: Math.round(yPercent * 100) / 100,
    });
  }

  const displayName = drawing?.display_name ?? t("drawing");
  const versionLabel = activeVersion
    ? `v${activeVersion.version_number}`
    : null;

  // Loading state
  if (drawingsLoading || versionsLoading || (urlLoading && !pdfUrl)) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="border-b shrink-0">
          <div className="px-4 py-3 flex items-center gap-3">
            <Skeleton className="h-8 w-24" />
            <Separator orientation="vertical" className="h-5" />
            <Skeleton className="h-5 w-48" />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Archive guard -- show info page for archived drawings
  const isArchivedDrawing = !drawingsLoading && drawing?.is_archived;
  if (isArchivedDrawing) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="border-b shrink-0">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                router.push(`/dashboard/projects/${projectId}`)
              }
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {tc("back")}
            </Button>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <Archive className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold mb-2">
            Diese Zeichnung ist archiviert
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            &bdquo;{drawing.display_name}&ldquo; wurde archiviert und kann nicht im Viewer angezeigt werden.
            Du findest sie im Archiv-Tab des Projekts.
          </p>
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}`)
            }
          >
            Zurueck zum Projekt
          </Button>
        </div>
      </div>
    );
  }

  // URL error state
  if (urlError) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="border-b shrink-0">
          <div className="px-4 py-3 flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                router.push(`/dashboard/projects/${projectId}`)
              }
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {tc("back")}
            </Button>
          </div>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <FileWarning className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h2 className="text-lg font-semibold mb-2">
            PDF konnte nicht geladen werden
          </h2>
          <p className="text-sm text-muted-foreground mb-6">{urlError}</p>
          <Button
            variant="outline"
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}`)
            }
          >
            Zurueck zum Projekt
          </Button>
        </div>
      </div>
    );
  }

  // Archived version hint
  const isArchivedVersion = activeVersion?.is_archived === true;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b shrink-0 bg-background z-10">
        {/* Row 1: Back button + drawing name */}
        <div className="px-3 sm:px-4 py-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              router.push(`/dashboard/projects/${projectId}`)
            }
            className="shrink-0 h-9 w-9 p-0 sm:h-auto sm:w-auto sm:px-3 sm:py-1.5"
          >
            <ArrowLeft className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Zurueck</span>
          </Button>

          <Separator
            orientation="vertical"
            className="h-5 hidden sm:block"
          />

          {/* Drawing name + version indicator + upload info */}
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">
                  {displayName}
                </span>
                {versionLabel && (
                  <Badge
                    variant={isArchivedVersion ? "secondary" : "outline"}
                    className="text-[10px] h-5 px-1.5 font-mono shrink-0"
                  >
                    {versionLabel}
                  </Badge>
                )}
              </div>
              <div className="hidden sm:block">
                <UploadInfo projectId={projectId} drawingId={activeDrawingId} />
              </div>
            </div>
          </div>

          {/* Desktop-only: controls inline */}
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVersionPanelOpen(true)}
              className="gap-1.5"
              aria-label="Versionspanel oeffnen"
            >
              <History className="h-3.5 w-3.5" />
              <span>Versionen</span>
              {versions.filter((v) => !v.is_archived).length > 1 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                  {versions.filter((v) => !v.is_archived).length}
                </Badge>
              )}
            </Button>

            <Separator orientation="vertical" className="h-5" />

            <Button
              variant={editMode ? "default" : "outline"}
              size="sm"
              onClick={() => setEditMode(!editMode)}
              className="gap-1.5"
            >
              {editMode ? (
                <>
                  <Pencil className="h-3.5 w-3.5" />
                  Bearbeiten
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  Ansicht
                </>
              )}
            </Button>

            <Separator orientation="vertical" className="h-5" />

            {numPages && numPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPreviousPage}
                  disabled={currentPage <= 1}
                  aria-label="Vorherige Seite"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm tabular-nums px-2 min-w-[60px] text-center">
                  {currentPage} / {numPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextPage}
                  disabled={currentPage >= numPages}
                  aria-label="Naechste Seite"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {fullscreenSupported && (
              <>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleFullscreen}
                  className="gap-1.5"
                  aria-label="Vollbildmodus aktivieren"
                >
                  <Maximize className="h-3.5 w-3.5" />
                  <span>Vollbild</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Row 2: Mobile-only controls toolbar */}
        <div className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 border-t overflow-x-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVersionPanelOpen(true)}
            className="gap-1 shrink-0 h-8"
            aria-label="Versionspanel oeffnen"
          >
            <History className="h-3.5 w-3.5" />
            {versions.filter((v) => !v.is_archived).length > 1 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {versions.filter((v) => !v.is_archived).length}
              </Badge>
            )}
          </Button>

          <Button
            variant={editMode ? "default" : "outline"}
            size="sm"
            onClick={() => setEditMode(!editMode)}
            className="gap-1 shrink-0 h-8"
          >
            {editMode ? (
              <Pencil className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>

          {fullscreenSupported && (
            <Button
              variant="outline"
              size="sm"
              onClick={toggleFullscreen}
              className="shrink-0 h-8 w-8 p-0"
              aria-label="Vollbildmodus aktivieren"
            >
              <Maximize className="h-3.5 w-3.5" />
            </Button>
          )}

          {numPages && numPages > 1 && (
            <div className="flex items-center gap-1 shrink-0 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPreviousPage}
                disabled={currentPage <= 1}
                aria-label="Vorherige Seite"
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs tabular-nums px-1 min-w-[44px] text-center">
                {currentPage}/{numPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={currentPage >= numPages}
                aria-label="Naechste Seite"
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Archived version banner */}
      {isArchivedVersion && (
        <div className="px-4 py-1.5 bg-muted border-b text-xs text-muted-foreground text-center">
          Archivierte Version -- diese Version wurde archiviert und ist
          nicht mehr die aktuelle Version.
        </div>
      )}

      {/* Navigation breadcrumb */}
      <NavigationBreadcrumb
        history={navHistory}
        currentDrawingName={displayName}
        onNavigate={handleBreadcrumbNavigate}
        onClear={handleClearHistory}
      />

      {/* Edit mode indicator */}
      {editMode && (
        <div className="px-4 py-1 bg-primary/10 border-b text-xs text-primary text-center">
          Bearbeitungsmodus -- Klicke auf die Zeichnung um einen Marker zu
          setzen. Rechtsklick auf Marker zum Bearbeiten.
        </div>
      )}

      {/* PDF Viewer */}
      <div ref={viewerContainerRef} className={`flex-1 overflow-hidden relative ${isFullscreen ? "bg-neutral-900" : ""}`}>
        {pdfError ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FileWarning className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              PDF kann nicht angezeigt werden
            </h2>
            <p className="text-sm text-muted-foreground">
              Die Datei ist moeglicherweise beschaedigt oder in einem
              nicht unterstuetzten Format.
            </p>
          </div>
        ) : (
          <TransformWrapper
            initialScale={1}
            minScale={0.3}
            maxScale={5}
            centerOnInit
            centerZoomedOut
            wheel={{ step: 0.1 }}
            panning={{ disabled: editMode }}
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                {/* Floating toolbar -- fullscreen only */}
                {isFullscreen && (
                  <FloatingToolbar
                    currentPage={currentPage}
                    numPages={numPages}
                    editMode={editMode}
                    activeVersionCount={versions.filter((v) => !v.is_archived).length}
                    onPreviousPage={goToPreviousPage}
                    onNextPage={goToNextPage}
                    onZoomIn={() => zoomIn()}
                    onZoomOut={() => zoomOut()}
                    onResetZoom={() => resetTransform()}
                    onToggleEditMode={() => setEditMode(!editMode)}
                    onExitFullscreen={exitFs}
                    onOpenVersionPanel={() => setVersionPanelOpen(true)}
                  />
                )}

                {/* Zoom controls -- hidden in fullscreen (handled by floating toolbar) */}
                <div className={`absolute bottom-4 right-4 sm:bottom-4 sm:right-4 z-10 flex items-center gap-1 bg-background/90 backdrop-blur-sm border rounded-lg p-1 shadow-sm ${isFullscreen ? "hidden" : ""}`}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => zoomIn()}
                    aria-label="Hineinzoomen"
                    className="h-11 w-11 sm:h-8 sm:w-8 p-0"
                  >
                    <ZoomIn className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => zoomOut()}
                    aria-label="Herauszoomen"
                    className="h-11 w-11 sm:h-8 sm:w-8 p-0"
                  >
                    <ZoomOut className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-5" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => resetTransform()}
                    aria-label="Zoom zuruecksetzen"
                    className="h-11 w-11 sm:h-8 sm:w-8 p-0"
                  >
                    <RotateCcw className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                </div>

                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="flex items-center justify-center"
                >
                  <div ref={pageContainerRef} className="relative inline-block">
                    <Document
                      file={pdfUrl}
                      onLoadSuccess={handleDocumentLoadSuccess}
                      onLoadError={handleDocumentLoadError}
                      loading={
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                      }
                    >
                      {pdfLoading && (
                        <div className="flex items-center justify-center">
                          <Skeleton className="w-[600px] h-[800px]" />
                        </div>
                      )}
                      <Page
                        pageNumber={currentPage}
                        renderTextLayer={false}
                        renderAnnotationLayer={false}
                        className="shadow-lg"
                      />
                    </Document>

                    {/* Marker overlay -- positioned on top of the PDF page */}
                    {!pdfLoading && !markersLoading && (
                      <MarkerOverlay
                        markers={markers}
                        currentPage={currentPage}
                        editMode={editMode}
                        drawings={drawings}
                        currentDrawingId={activeDrawingId}
                        getSignedUrl={getSignedUrl}
                        onMarkerClick={handleMarkerClick}
                        onMarkerRename={handleMarkerRename}
                        onMarkerRetarget={handleMarkerRetarget}
                        onMarkerDelete={handleMarkerDelete}
                        onMarkerDrag={handleMarkerDrag}
                        onPageClick={handlePageClick}
                      />
                    )}
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        )}
      </div>

      {/* Marker creation dialog */}
      <MarkerCreationDialog
        open={creationPos !== null}
        onOpenChange={(open) => {
          if (!open) setCreationPos(null);
        }}
        drawings={drawings}
        currentDrawingId={activeDrawingId}
        onSubmit={handleCreateMarker}
      />

      {/* Version side panel */}
      <VersionSidePanel
        open={versionPanelOpen}
        onOpenChange={setVersionPanelOpen}
        versions={versions}
        loading={versionsLoading}
        activeVersionId={activeVersion?.id ?? null}
        drawingName={displayName}
        onSelectVersion={handleSelectVersion}
        onUploadVersion={handleUploadVersion}
        onRenameVersion={handleRenameVersion}
        onArchiveVersion={handleArchiveVersion}
      />
    </div>
  );
}

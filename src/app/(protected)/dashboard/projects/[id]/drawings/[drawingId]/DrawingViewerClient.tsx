"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  TransformWrapper,
  TransformComponent,
  type ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
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
import { useDrawingStatuses } from "@/hooks/use-drawing-statuses";
import { MarkerOverlay } from "@/components/drawings/MarkerOverlay";
import { MarkerCreationDialog } from "@/components/drawings/MarkerCreationDialog";
import {
  NavigationBreadcrumb,
  type NavHistoryEntry,
} from "@/components/drawings/NavigationBreadcrumb";
import { VersionSidePanel } from "@/components/drawings/VersionSidePanel";
import { Logo } from "@/components/Logo";
import { FloatingToolbar } from "@/components/drawings/FloatingToolbar";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { UploadInfo } from "@/components/drawings/UploadInfo";
import type { MarkerWithTarget, MarkerColor } from "@/lib/types/marker";
import { useTranslations } from "next-intl";
import { getCachedPdfByStoragePath } from "@/lib/offline/pdf-cache";
import dynamic from "next/dynamic";
const SyncStatusBadge = dynamic(
  () => import("@/components/sync/SyncStatusBadge").then((m) => m.SyncStatusBadge),
  { ssr: false }
);

// Worker liegt in public/ — gleicher Origin, kein Bundler-Magic, klappt
// auch in dynamic-importierten Modulen (s. lib/thumbnails/render.ts).
pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs-worker.min.mjs";

// Module-level cache for version signed URLs. Supabase signs URLs for 1 h, so
// we hold on to them for slightly less (50 min) and reuse across remounts —
// the viewer re-mounts every time a user opens a drawing, and without this
// we'd fire a fresh /versions/[id]/url API call every single time.
const SIGNED_URL_TTL_MS = 50 * 60 * 1000;
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

function readSignedUrlCache(versionId: string): string | null {
  const entry = signedUrlCache.get(versionId);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    signedUrlCache.delete(versionId);
    return null;
  }
  return entry.url;
}

function writeSignedUrlCache(versionId: string, url: string) {
  signedUrlCache.set(versionId, { url, expiresAt: Date.now() + SIGNED_URL_TTL_MS });
}

interface DrawingViewerClientProps {
  params: Promise<{ id: string; drawingId: string }>;
}

export function DrawingViewerClient({ params }: DrawingViewerClientProps) {
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
    refetch: refetchDrawings,
  } = useDrawings(projectId);

  const { statuses, loading: statusesLoading } = useDrawingStatuses();

  // Current drawing can change when navigating via markers
  const [activeDrawingId, setActiveDrawingId] = useState(initialDrawingId);

  const {
    versions,
    loading: versionsLoading,
    latestActiveVersion,
    uploadVersion,
    renameVersion,
    updateVersion,
    moveVersion,
    regenerateThumbnail,
    archiveVersion,
    getVersionSignedUrl,
    updateVersionStatus,
    refetch: refetchVersions,
  } = useVersions(projectId, activeDrawingId);

  // Active version: from URL param, or latest active version
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    initialVersionId
  );

  // Determine the actual version to display
  // Guard: prefer a version that belongs to the current drawing, but fall back gracefully
  const activeVersion = (() => {
    // First: try selected version if it matches current drawing
    const selected = versions.find((v) => v.id === selectedVersionId);
    if (selected && selected.drawing_id === activeDrawingId) return selected;
    // Second: latest active version for this drawing
    if (latestActiveVersion && latestActiveVersion.drawing_id === activeDrawingId) return latestActiveVersion;
    // Third (offline fallback): if versions exist but drawing_id doesn't match yet
    // (can happen when cache returns data before hooks re-render), use latestActiveVersion anyway
    if (latestActiveVersion && versions.length > 0 && !selectedVersionId) return latestActiveVersion;
    return undefined;
  })();

  const {
    markers,
    loading: markersLoading,
    createMarker,
    updateMarker,
    deleteMarker,
  } = useMarkers(projectId, activeDrawingId, activeVersion?.id);

  const [pdfUrl, _setPdfUrl] = useState<string | null>(null);
  const prevBlobUrlRef = useRef<string | null>(null);
  // Wrap setPdfUrl to automatically revoke previous blob URLs (prevent memory leaks)
  const setPdfUrl = useCallback((url: string | null) => {
    _setPdfUrl((prev) => {
      if (prev && prev.startsWith("blob:") && prev !== url) {
        URL.revokeObjectURL(prev);
      }
      if (prevBlobUrlRef.current && prevBlobUrlRef.current.startsWith("blob:") && prevBlobUrlRef.current !== url) {
        URL.revokeObjectURL(prevBlobUrlRef.current);
      }
      prevBlobUrlRef.current = url?.startsWith("blob:") ? url : null;
      return url;
    });
  }, []);
  const [urlLoading, setUrlLoading] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfLoading, setPdfLoading] = useState(true);
  const [pdfError, setPdfError] = useState(false);

  // Read-only check (viewer/guest)
  const [isReadOnly, setIsReadOnly] = useState(false);
  useEffect(() => {
    let cancelled = false;
    async function checkRole() {
      const supabase = (await import("@/lib/supabase")).createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_role")
        .eq("id", user.id)
        .single();
      if (!cancelled && (profile?.tenant_role === "viewer" || profile?.tenant_role === "guest")) {
        setIsReadOnly(true);
      }
    }
    checkRole();
    return () => { cancelled = true; };
  }, []);

  // Version panel state
  const [versionPanelOpen, setVersionPanelOpen] = useState(false);

  // Persistent rotation: stored per-version as a DELTA on top of the PDF's
  // intrinsic /Rotate metadata. Display angle = (intrinsic + delta) % 360.
  // Clicking rotate advances delta in 90-degree steps and PATCHes the
  // version so the angle sticks. Optimistic UI via pendingRotation keeps
  // the canvas stable until React Query refetches. MUST stay above any
  // early returns so the hook order is stable.
  const [pendingRotation, setPendingRotation] = useState<number | null>(null);
  const [intrinsicRotation, setIntrinsicRotation] = useState(0);

  // Marker state
  const [editMode, setEditMode] = useState(false);
  const [creationPos, setCreationPos] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [navHistory, setNavHistory] = useState<NavHistoryEntry[]>([]);

  const pageContainerRef = useRef<HTMLDivElement>(null);
  // Held in a ref so other effects (e.g. fullscreen) can read it, but also
  // exposed via a callback ref below so we can wire up the ResizeObserver
  // exactly when the node enters the DOM. The viewer mounts after multiple
  // early-returns (loading, archive-guard, urlError) — a plain
  // useLayoutEffect with [] runs while the ref is still null and never
  // re-runs once the real container appears.
  const viewerContainerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  // Ref to react-zoom-pan-pinch so we can reset zoom/pan when the user
  // navigates to a different drawing, version, or page — otherwise the old
  // pan offset can park the new (differently-sized) PDF off-screen.
  const transformRef = useRef<ReactZoomPanPinchRef | null>(null);

  // Container dimensions, kept in sync via ResizeObserver. Tracked
  // separately so fittedWidth can be derived as a function of *both* the
  // available width AND height — otherwise portrait PDFs overflow the
  // viewport and landscape ones leave the bottom empty.
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null);

  // Aspect ratio (width / height) used for the placeholder/sized container,
  // so the layout box stays the right shape even before the first Page paints.
  // Default is rough A-series landscape (≈ √2). After Document parses we
  // refine it with the actual PDF page-1 viewport (with the PDF's intrinsic
  // rotation already applied — getViewport without a rotation arg returns
  // the dimensions react-pdf shows by default).
  const [pdfAspect, setPdfAspect] = useState(1.414);

  // The user's rotation delta on top of the intrinsic angle. Same value
  // that's later passed to <Page rotate={...}>. Computed up here so the
  // aspect-ratio math (which has to flip when the page is shown sideways)
  // can read it before fittedWidth is derived.
  const currentRotationDelta = pendingRotation ?? activeVersion?.rotation ?? 0;
  const isRotatedSideways =
    currentRotationDelta === 90 || currentRotationDelta === 270;
  // Aspect AFTER the user delta: if the page is sideways we swap.
  const effectiveAspect = isRotatedSideways ? 1 / pdfAspect : pdfAspect;

  // Fit-to-container width: never exceed available width, never let height
  // exceed available height. Padded by 48 px on each axis. Recomputed
  // automatically when the container resizes or the PDF's aspect changes.
  const fittedWidth = (() => {
    if (!containerSize) return undefined;
    const PAD = 48;
    const availW = containerSize.w - PAD;
    const availH = containerSize.h - PAD;
    if (availW <= 0 || availH <= 0) return undefined;
    return Math.floor(Math.min(availW, availH * effectiveAspect));
  })();

  // Progressive rendering: a fast low-res canvas appears immediately, then
  // a hi-res one renders in the background and replaces it on success.
  //
  // Hi-res rendering is gated on the low-res being done (see lowResReady
  // below). On mobile PDF.js effectively owns a single worker, so kicking
  // off both renders at the same time used to delay the first-paint — now
  // the user sees the low-res version first and the hi-res arrives later.
  //
  // highDpr is picked for device density × 3 (was ×4), clamped 4..10
  // (was ..16). The 4k→16k canvas-pixel-per-CSS-px reduction cuts mobile
  // render time roughly in half while still giving ~3× zoom headroom on
  // a 3× DPR phone. Final value is also clamped by the canvas-area
  // budget so we never exceed mobile Chrome's bitmap limit.
  const deviceDpr = typeof window !== "undefined" ? window.devicePixelRatio : 1;
  const lowDpr = Math.ceil(deviceDpr);
  const baseHighDpr = Math.min(10, Math.max(4, Math.ceil(deviceDpr * 3)));

  const [lowResReady, setLowResReady] = useState(false);
  const [hiResReady, setHiResReady] = useState(false);

  // ~45 MP cap leaves comfortable headroom below mobile Chrome's canvas
  // limit (~64 MP) while keeping enough budget for DPR ≥ 10 on mobile.
  const MAX_CANVAS_AREA_PX = 45_000_000;
  const A4_ASPECT = 1.45;
  const canvasDprCap = fittedWidth
    ? Math.max(2, Math.floor(Math.sqrt(MAX_CANVAS_AREA_PX / (fittedWidth * fittedWidth * A4_ASPECT))))
    : 10;
  const highDpr = Math.max(4, Math.min(canvasDprCap, baseHighDpr));

  // Reset both progressive tiers when the visible page/drawing/version
  // changes. Both <Page>s stay mounted across the change — react-pdf
  // repaints their canvases internally for the new pageNumber. The
  // placeholder fades back in until lowRes reports onRenderSuccess.
  useEffect(() => {
    setLowResReady(false);
    setHiResReady(false);
  }, [currentPage, activeDrawingId, activeVersion?.id]);

  // Callback ref for the viewer container. Fires every time the node
  // attaches/detaches — including when the early-return loading branch
  // unmounts and the real viewer JSX mounts. We wire up the ResizeObserver
  // here so fittedWidth is computed BEFORE the first <Page> render.
  const setViewerContainerRef = useCallback((node: HTMLDivElement | null) => {
    viewerContainerRef.current = node;

    // Tear down any previous observer (component re-render with new node).
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;

    if (!node) return;

    const measure = () => {
      const w = node.clientWidth;
      const h = node.clientHeight;
      if (w > 0 && h > 0) setContainerSize({ w, h });
    };

    // Initial measurement happens on next frame so layout is settled.
    requestAnimationFrame(measure);
    const obs = new ResizeObserver(measure);
    obs.observe(node);
    resizeObserverRef.current = obs;
  }, []);

  useEffect(() => {
    return () => {
      resizeObserverRef.current?.disconnect();
    };
  }, []);

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

  // Reset zoom + pan as soon as the new low-res canvas has painted. Doing
  // this only after onRenderSuccess (which flips lowResReady to true)
  // guarantees the content is in the DOM at the moment we measure for
  // centerView — otherwise the old content's bounding box is used and the
  // new (differently-sized) Page lands off-screen.
  useEffect(() => {
    if (!lowResReady) return;
    transformRef.current?.resetTransform(0);
    transformRef.current?.centerView(1, 0);
  }, [lowResReady, activeDrawingId, activeVersion?.id, currentPage]);

  // Fetch signed URL for the active version
  const prevVersionRef = useRef<string | null>(null);
  const fetchUrl = useCallback(async () => {
    if (!activeVersion) return;

    // Don't reset PDF display if same version (avoid flicker on background revalidation)
    const isSameVersion = prevVersionRef.current === activeVersion.id;
    prevVersionRef.current = activeVersion.id;

    // Fast path: module-level cache hit. Reusing the exact same URL string
    // also lets react-pdf skip re-parsing the PDFDocumentProxy on remount.
    const cached = readSignedUrlCache(activeVersion.id);
    if (cached) {
      setPdfUrl(cached);
      setUrlLoading(false);
      setUrlError(null);
      if (!isSameVersion) {
        setPdfLoading(true);
        setPdfError(false);
      }
      return;
    }

    setUrlLoading(true);
    setUrlError(null);
    if (!isSameVersion) {
      setPdfLoading(true);
      setPdfError(false);
    }
    // If offline, try to load PDF from cache directly
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      if (activeVersion.storage_path) {
        const cachedBlobUrl = await getCachedPdfByStoragePath(activeVersion.storage_path);
        if (cachedBlobUrl) {
          setPdfUrl(cachedBlobUrl);
          setPdfLoading(false);
          setUrlLoading(false);
          return;
        }
      }
      setUrlError(t("toasts.pdfUrlFailed"));
      setUrlLoading(false);
      return;
    }

    try {
      const url = await getVersionSignedUrl(activeVersion.id);
      writeSignedUrlCache(activeVersion.id, url);
      setPdfUrl(url);
    } catch (err) {
      // Network failed — try offline cache as last resort
      if (activeVersion.storage_path) {
        const cachedBlobUrl = await getCachedPdfByStoragePath(activeVersion.storage_path);
        if (cachedBlobUrl) {
          setPdfUrl(cachedBlobUrl);
          setUrlLoading(false);
          return;
        }
      }
      setUrlError(
        err instanceof Error
          ? err.message
          : t("toasts.pdfUrlFailed")
      );
    } finally {
      setUrlLoading(false);
    }
  }, [activeVersion, getVersionSignedUrl, setPdfUrl, t]);

  useEffect(() => {
    if (activeVersion) {
      // Clear the previous URL the moment we switch drawings/versions so
      // <Document key={pdfUrl}> tears down the old canvases right away.
      // fetchUrl below restores it from cache or network. Without this,
      // the previous PDF lingers on screen until fetchUrl resolves and
      // the user briefly sees the old drawing "again" before the new one.
      if (prevVersionRef.current !== activeVersion.id) {
        setPdfUrl(null);
      }
      fetchUrl();
      setCurrentPage(1);
      setNumPages(null);
      // fittedWidth is NOT reset — it depends on the container, not the PDF.
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only refetch when version ID changes, not the full object
  }, [activeVersion?.id, fetchUrl]);

  // Update URL query param when version changes (without full navigation)
  useEffect(() => {
    if (activeVersion && activeVersion.id !== initialVersionId) {
      const url = new URL(window.location.href);
      url.searchParams.set("versionId", activeVersion.id);
      window.history.replaceState(null, "", url.toString());
    }
  }, [activeVersion, initialVersionId]);

  async function handleDocumentLoadSuccess(pdf: {
    numPages: number;
    getPage: (n: number) => Promise<{
      rotate?: number;
      getViewport: (opts: { scale: number }) => { width: number; height: number };
    }>;
  }) {
    setNumPages(pdf.numPages);
    setPdfLoading(false);

    // Lazy-repair: backfill page_count for versions uploaded before the
    // client started sending it. Fire-and-forget; failures are silent.
    if (
      activeVersion &&
      (activeVersion.page_count == null || activeVersion.page_count !== pdf.numPages)
    ) {
      updateVersion(activeVersion.id, { page_count: pdf.numPages }).catch(() => {});
    }

    // Pull page-1 metadata: intrinsic rotation (for thumb/viewer parity) and
    // aspect ratio (sizes our placeholder so the layout box matches the PDF
    // before the first paint). fittedWidth is already managed by the
    // ResizeObserver — we don't touch it here.
    try {
      const page = await pdf.getPage(1);
      setIntrinsicRotation(((page.rotate ?? 0) % 360 + 360) % 360);
      const vp = page.getViewport({ scale: 1 });
      if (vp.width > 0 && vp.height > 0) {
        setPdfAspect(vp.width / vp.height);
      }
    } catch {
      // Default aspect stays in place.
    }
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

  async function handleCreateMarker(name: string, targetDrawingId: string, color: MarkerColor) {
    if (!creationPos) return;
    await createMarker({
      name,
      color,
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

  async function handleStatusChange(versionId: string, statusId: string | null) {
    // Optimistic update
    updateVersionStatus(versionId, statusId, statuses);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/drawings/${activeDrawingId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status_id: statusId, version_id: versionId }),
        }
      );

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error ?? t("toasts.renameFailed"));
      }

      toast.success(t("statusChanged"));
    } catch (err) {
      // Revert on error
      await refetchVersions();
      toast.error(
        err instanceof Error ? err.message : t("toasts.renameFailed")
      );
    }
  }

  async function handleMarkerRename(markerId: string, name: string) {
    await updateMarker(markerId, { name });
    toast.success(tm("renamed"));
  }

  async function handleMarkerRetarget(markerId: string, targetId: string) {
    await updateMarker(markerId, { target_drawing_id: targetId });
    toast.success(tm("targetChanged"));
  }

  async function handleMarkerColorChange(markerId: string, color: string) {
    await updateMarker(markerId, { color: color as MarkerColor });
  }

  async function handleMarkerDelete(markerId: string) {
    await deleteMarker(markerId);
    toast.success(tm("deleted"));
  }

  /**
   * Duplicate a marker within the same drawing + version.
   * The copy sits ~3% diagonally from the original so it is visible
   * and doesn't overlap. If the source is near the right/bottom edge
   * we offset in the opposite direction so the copy doesn't clamp onto
   * the source (which would make duplicate-of-duplicate look like it
   * failed silently). Keeps colour + target + page; suffixes the name
   * with " (Kopie)" (or numbered suffix if already taken). The DB name
   * limit is 50 chars — truncate before appending so deep copy chains
   * don't hit a CHECK-constraint violation.
   */
  async function handleMarkerDuplicate(marker: MarkerWithTarget) {
    const MAX_NAME = 50;
    const suffix = " (Kopie)";
    const truncatedBase = marker.name.length + suffix.length > MAX_NAME
      ? marker.name.slice(0, MAX_NAME - suffix.length).trimEnd()
      : marker.name;
    const base = `${truncatedBase}${suffix}`;
    const existingNames = new Set(markers.map((m) => m.name));
    let name = base;
    let counter = 2;
    while (existingNames.has(name) && counter < 100) {
      const numbered = ` (Kopie ${counter})`;
      const headroom = MAX_NAME - numbered.length;
      const trimmedHead = marker.name.length > headroom
        ? marker.name.slice(0, headroom).trimEnd()
        : marker.name;
      name = `${trimmedHead}${numbered}`;
      counter++;
    }

    const dx = marker.x_percent > 97 ? -3 : 3;
    const dy = marker.y_percent > 97 ? -3 : 3;
    const offsetX = Math.min(100, Math.max(0, marker.x_percent + dx));
    const offsetY = Math.min(100, Math.max(0, marker.y_percent + dy));

    try {
      await createMarker({
        name,
        color: marker.color,
        target_drawing_id: marker.target_drawing_id,
        page_number: marker.page_number,
        x_percent: Math.round(offsetX * 100) / 100,
        y_percent: Math.round(offsetY * 100) / 100,
      });
      toast.success(tm("duplicated"));
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Marker konnte nicht kopiert werden"
      );
    }
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

  // Previous/next drawing navigation
  const activeDrawings = drawings.filter((d) => !d.is_archived);
  const currentIndex = activeDrawings.findIndex((d) => d.id === activeDrawingId);
  const prevDrawing = currentIndex > 0 ? activeDrawings[currentIndex - 1] : null;
  const nextDrawing = currentIndex < activeDrawings.length - 1 ? activeDrawings[currentIndex + 1] : null;

  function navigateToDrawing(drawingId: string) {
    setActiveDrawingId(drawingId);
    setSelectedVersionId(null);
    setNavHistory([]);
  }

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
            Zurück zum Projekt
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
            Zurück zum Projekt
          </Button>
        </div>
      </div>
    );
  }

  // Archived version hint
  const isArchivedVersion = activeVersion?.is_archived === true;

  // Re-use the rotation delta computed above for the aspect math.
  const rotationDelta = currentRotationDelta;
  // react-pdf: null → respect intrinsic; number → absolute override.
  // Pass null when the user delta is 0 so the PDF's own /Rotate wins and
  // the viewer matches the thumbnail.
  const effectiveRotation: number | null =
    rotationDelta === 0 ? null : (intrinsicRotation + rotationDelta) % 360;

  async function handleRotate() {
    if (!activeVersion) return;
    const next = ((activeVersion.rotation ?? 0) + 90) % 360;
    setPendingRotation(next);
    try {
      await updateVersion(activeVersion.id, { rotation: next });
      // Re-bake the thumbnail JPEG so the card + viewer placeholder reflect
      // the new orientation. Fire-and-forget — the viewer canvas has
      // already rotated optimistically via pendingRotation.
      regenerateThumbnail(activeVersion, next).catch(() => {});
    } catch (err) {
      setPendingRotation(null);
      toast.error(err instanceof Error ? err.message : "Drehung fehlgeschlagen");
    } finally {
      // React Query has refetched by now; clear the local override.
      setPendingRotation(null);
    }
  }

  // "Old version" watermark: shown whenever the visible version is not the
  // latest active one for this drawing. Includes archived versions (which
  // are non-current by definition). Deliberately a viewport-fixed overlay
  // so it stays visible and un-zoomable as the user pans the PDF.
  const isOldVersion = Boolean(
    activeVersion &&
      latestActiveVersion &&
      activeVersion.id !== latestActiveVersion.id
  );

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
            <span className="hidden sm:inline">Zurück</span>
          </Button>

          <Logo size="sm" className="hidden sm:inline-flex" />

          <Separator
            orientation="vertical"
            className="h-5 hidden sm:block"
          />

          {/* Drawing navigation + name + version indicator + upload info */}
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={!prevDrawing}
              onClick={() => prevDrawing && navigateToDrawing(prevDrawing.id)}
              className="shrink-0 h-7 w-7 p-0"
              aria-label="Vorherige Zeichnung"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
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
                {activeVersion?.status && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-medium leading-none rounded-full border px-1.5 py-0.5 shrink-0"
                    style={{ borderColor: activeVersion.status.color }}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
                      style={{ backgroundColor: activeVersion.status.color }}
                      aria-hidden="true"
                    />
                    {activeVersion.status.name}
                  </span>
                )}
              </div>
              <div className="hidden sm:block">
                <UploadInfo projectId={projectId} drawingId={activeDrawingId} />
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={!nextDrawing}
              onClick={() => nextDrawing && navigateToDrawing(nextDrawing.id)}
              className="shrink-0 h-7 w-7 p-0"
              aria-label="Nächste Zeichnung"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop-only: controls inline */}
          <div className="hidden sm:flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVersionPanelOpen(true)}
              className="gap-1.5"
              aria-label="Versionspanel öffnen"
            >
              <History className="h-3.5 w-3.5" />
              <span>Versionen</span>
              {versions.filter((v) => !v.is_archived).length > 1 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1 ml-0.5">
                  {versions.filter((v) => !v.is_archived).length}
                </Badge>
              )}
            </Button>

            {!isReadOnly && (
              <>
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
              </>
            )}

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
                  aria-label="Nächste Seite"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            {!isReadOnly && activeVersion && (
              <>
                <Separator orientation="vertical" className="h-5" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRotate}
                  className="gap-1.5"
                  aria-label="90 Grad drehen"
                  title="Version um 90° drehen (wird gespeichert)"
                >
                  <RotateCw className="h-3.5 w-3.5" />
                  <span>Drehen</span>
                </Button>
              </>
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
            <SyncStatusBadge />
          </div>
        </div>

        {/* Row 2: Mobile-only controls toolbar */}
        <div className="flex sm:hidden items-center gap-1.5 px-3 py-1.5 border-t overflow-x-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setVersionPanelOpen(true)}
            className="gap-1 shrink-0 h-8"
            aria-label="Versionspanel öffnen"
          >
            <History className="h-3.5 w-3.5" />
            {versions.filter((v) => !v.is_archived).length > 1 && (
              <Badge variant="secondary" className="text-[10px] h-4 px-1">
                {versions.filter((v) => !v.is_archived).length}
              </Badge>
            )}
          </Button>

          {!isReadOnly && (
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
          )}

          {!isReadOnly && activeVersion && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotate}
              className="shrink-0 h-8 w-8 p-0"
              aria-label="90 Grad drehen"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </Button>
          )}

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
      <div ref={setViewerContainerRef} className={`flex-1 overflow-hidden relative ${isFullscreen ? "bg-neutral-900" : ""}`}>
        {/* Old-version watermark: viewport-fixed, non-interactive, above the
            PDF but below toolbars. Only shown when viewing a non-current
            version of this drawing. */}
        {isOldVersion && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center select-none"
          >
            <span
              className="text-[9vw] sm:text-[7vw] md:text-[5vw] font-black uppercase tracking-widest text-destructive/20 whitespace-nowrap"
              style={{ transform: "rotate(-25deg)" }}
            >
              {t("watermark.oldVersion")}
            </span>
          </div>
        )}
        {pdfError ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <FileWarning className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              PDF kann nicht angezeigt werden
            </h2>
            <p className="text-sm text-muted-foreground">
              Die Datei ist möglicherweise beschädigt oder in einem
              nicht unterstützten Format.
            </p>
          </div>
        ) : (
          <TransformWrapper
            ref={transformRef}
            initialScale={1}
            minScale={0.3}
            maxScale={10}
            limitToBounds={false}
            centerOnInit
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
                    aria-label="Zoom zurücksetzen"
                    className="h-11 w-11 sm:h-8 sm:w-8 p-0"
                  >
                    <RotateCcw className="h-5 w-5 sm:h-4 sm:w-4" />
                  </Button>
                </div>

                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full !flex !items-center !justify-center"
                >
                  {/* The render box. Two layout strategies:
                      - The `min-w/min-h` style guarantees the container has
                        dimensions BEFORE the first canvas paints, so the
                        placeholder shows at roughly the right size and the
                        layout doesn't collapse to 0 mid-transition.
                      - Once <Page> mounts the canvas, the canvas itself
                        contributes its real dimensions; the container grows
                        if needed.
                      We only attempt to mount the Document after fittedWidth
                      is known so the first render is at the final size. */}
                  {fittedWidth ? (
                    <div
                      ref={pageContainerRef}
                      className="relative inline-block shadow-lg bg-white"
                      style={{
                        minWidth: fittedWidth,
                        // Match the canvas' rotated-aware height so the
                        // frame follows the user's 90°/270° rotation.
                        minHeight: Math.round(fittedWidth / effectiveAspect),
                      }}
                    >
                      {/* Placeholder layered on top of (or in lieu of) the
                          PDF page until the low-res canvas of the current
                          page has painted. Server thumbnail for page 1,
                          plain skeleton otherwise. */}
                      {!lowResReady && (
                        drawing?.thumbnail_url && currentPage === 1 ? (
                          <img
                            src={drawing.thumbnail_url}
                            alt=""
                            className="absolute inset-0 w-full h-full object-contain pointer-events-none z-10"
                            aria-hidden="true"
                          />
                        ) : (
                          <Skeleton className="absolute inset-0 z-10" />
                        )
                      )}

                      <Document
                        // key forces a full remount when pdfUrl changes —
                        // i.e. on drawing or version switch. Without it,
                        // react-pdf only swaps the file prop and the old
                        // canvases stay on screen until the new PDF
                        // finishes parsing, which looked like the previous
                        // drawing was being "shown again" before the new
                        // one arrived.
                        key={pdfUrl ?? "no-pdf"}
                        file={pdfUrl}
                        onLoadSuccess={handleDocumentLoadSuccess}
                        onLoadError={handleDocumentLoadError}
                        loading={null}
                      >
                        {/* Low-res Page is in normal flow; its canvas gives
                            the container its true natural size as soon as
                            it paints. */}
                        <Page
                          pageNumber={currentPage}
                          rotate={effectiveRotation}
                          renderTextLayer={false}
                          renderAnnotationLayer={false}
                          width={fittedWidth}
                          devicePixelRatio={lowDpr}
                          canvasBackground="white"
                          onRenderSuccess={() => setLowResReady(true)}
                        />
                        {/* Hi-res sits on top of low-res; fades in when its
                            render for the current page finishes. Both stay
                            mounted across page changes — react-pdf repaints
                            their canvases without unmount/remount, so the
                            container never collapses. */}
                        <div
                          // Smooth fade-IN only. When hiResReady flips back
                          // to false (page change, version switch), we
                          // disappear instantly — otherwise the transition
                          // would slowly fade out the old page while the
                          // new one is rendering, making the old drawing
                          // appear to "linger" on screen for ~150 ms.
                          className={
                            hiResReady
                              ? "absolute inset-0 transition-opacity duration-150 opacity-100"
                              : "absolute inset-0 opacity-0 pointer-events-none"
                          }
                        >
                          <Page
                            pageNumber={currentPage}
                            rotate={effectiveRotation}
                            renderTextLayer={false}
                            renderAnnotationLayer={false}
                            width={fittedWidth}
                            devicePixelRatio={highDpr}
                            canvasBackground="white"
                            onRenderSuccess={() => setHiResReady(true)}
                          />
                        </div>
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
                          onMarkerColorChange={handleMarkerColorChange}
                          onMarkerDelete={handleMarkerDelete}
                          onMarkerDuplicate={handleMarkerDuplicate}
                          onMarkerDrag={handleMarkerDrag}
                          onPageClick={handlePageClick}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  )}
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
        onUpdateDate={async (id, isoDate) => {
          await updateVersion(id, { created_at: isoDate });
        }}
        onMoveVersion={async (id, direction) => {
          await moveVersion(id, direction);
        }}
        statuses={statuses}
        onStatusChange={handleStatusChange}
        canEdit={!isReadOnly}
      />
    </div>
  );
}

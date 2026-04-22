"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCachedThumbnail,
  cacheThumbnail,
  canvasToThumbnail,
  canvasToThumbnailBlob,
} from "@/lib/offline/thumbnail-cache";
import { uploadThumbnail } from "@/lib/thumbnails/upload";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PdfThumbnailProps {
  url: string;
  width?: number;
  /** Unique cache key — use drawingId or versionId */
  cacheKey?: string;
  /** Context for the lazy-repair path (legacy drawings). When all four are
   *  present AND the drawing still has no server-side thumbnail, the
   *  rendered JPEG is uploaded once and linked via the thumbnail API so the
   *  next viewer skips this work entirely. */
  drawingId?: string;
  versionId?: string | null;
  projectId?: string;
  pdfStoragePath?: string | null;
}

// Per-session guard so we only repair a given version once, even if the
// component remounts (e.g. user scrolls the grid away and back).
const repairedVersionIds = new Set<string>();

export function PdfThumbnail({
  url,
  width = 200,
  cacheKey,
  drawingId,
  versionId,
  projectId,
  pdfStoragePath,
}: PdfThumbnailProps) {
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [cachedDataUrl, setCachedDataUrl] = useState<string | null>(null);
  const [showPdfRenderer, setShowPdfRenderer] = useState(!cacheKey);
  const pageRef = useRef<HTMLDivElement>(null);

  // Try to load cached thumbnail
  useEffect(() => {
    if (!cacheKey) return;

    let cancelled = false;

    getCachedThumbnail(cacheKey).then((dataUrl) => {
      if (cancelled) return;
      if (dataUrl) {
        setCachedDataUrl(dataUrl);
        setLoaded(true);
      } else {
        setShowPdfRenderer(true);
      }
    });

    return () => { cancelled = true; };
  }, [cacheKey]);

  async function handleRenderSuccess() {
    setLoaded(true);

    if (!pageRef.current) return;
    const canvas = pageRef.current.querySelector("canvas");
    if (!canvas) return;

    // Cache in IndexedDB for fast client-side reloads.
    if (cacheKey) {
      try {
        const dataUrl = canvasToThumbnail(canvas, width);
        cacheThumbnail(cacheKey, dataUrl);
      } catch {
        // Canvas tainted or other error — ignore
      }
    }

    // Lazy-repair: upload the rendered thumbnail so future viewers don't
    // re-render the PDF. Runs once per session per version, only when the
    // parent supplied the context needed to map a Storage path.
    if (
      versionId &&
      drawingId &&
      projectId &&
      pdfStoragePath &&
      !repairedVersionIds.has(versionId)
    ) {
      repairedVersionIds.add(versionId);
      try {
        const blob = await canvasToThumbnailBlob(canvas, 400, 0.7);
        if (!blob) return;
        const thumbnailPath = await uploadThumbnail(pdfStoragePath, blob);
        if (!thumbnailPath) return;
        await fetch(
          `/api/projects/${projectId}/drawings/${drawingId}/versions/${versionId}/thumbnail`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thumbnail_path: thumbnailPath }),
          }
        );
      } catch {
        // Best-effort — swallow errors so they don't surface as toasts.
      }
    }
  }

  if (hasError) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded w-full h-full"
        aria-label="PDF-Vorschau nicht verfuegbar"
      >
        <FileText className="h-10 w-10 text-muted-foreground/40" />
      </div>
    );
  }

  // Show cached thumbnail image (fast, works offline)
  if (cachedDataUrl) {
    return (
      <div className="w-full h-full flex items-center justify-center p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL from IndexedDB cache, not a remote image */}
        <img
          src={cachedDataUrl}
          alt="PDF Vorschau"
          className="max-w-full max-h-full object-contain rounded"
        />
      </div>
    );
  }

  // Show PDF renderer (first load, generates thumbnail for caching)
  if (!showPdfRenderer) {
    return (
      <Skeleton className="w-full h-full rounded" />
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden" ref={pageRef}>
      {!loaded && (
        <Skeleton className="absolute inset-0" />
      )}
      <Document
        file={url}
        onLoadError={() => setHasError(true)}
        loading={null}
      >
        <Page
          pageNumber={1}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onRenderSuccess={handleRenderSuccess}
        />
      </Document>
    </div>
  );
}

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
} from "@/lib/offline/thumbnail-cache";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

interface PdfThumbnailProps {
  url: string;
  width?: number;
  /** Unique cache key — use drawingId or versionId */
  cacheKey?: string;
  /** Context is accepted for forward-compat with a future batched repair
   *  path; currently unused to keep the render hot path cheap. */
  drawingId?: string;
  versionId?: string | null;
  projectId?: string;
  pdfStoragePath?: string | null;
}

export function PdfThumbnail({
  url,
  width = 200,
  cacheKey,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept in API for future lazy-repair
  drawingId: _drawingId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  versionId: _versionId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  projectId: _projectId,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  pdfStoragePath: _pdfStoragePath,
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

  function handleRenderSuccess() {
    setLoaded(true);

    if (!cacheKey || !pageRef.current) return;
    const canvas = pageRef.current.querySelector("canvas");
    if (!canvas) return;

    // Cache in IndexedDB for fast client-side reloads.
    try {
      const dataUrl = canvasToThumbnail(canvas, width);
      cacheThumbnail(cacheKey, dataUrl);
    } catch {
      // Canvas tainted or other error — ignore
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

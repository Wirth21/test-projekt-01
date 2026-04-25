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

// Per-session guard so we only attempt the repair upload once per version
// across the whole card grid — otherwise every card that lazily renders the
// same drawing hits Storage + the repair endpoint repeatedly.
const repairedVersions = new Set<string>();

async function repairServerThumbnail(
  canvas: HTMLCanvasElement,
  ctx: {
    projectId: string;
    drawingId: string;
    versionId: string;
  }
) {
  if (repairedVersions.has(ctx.versionId)) return;
  repairedVersions.add(ctx.versionId);

  const jpeg = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
  });
  if (!jpeg) {
    console.warn("[thumb-repair] canvas.toBlob returned null");
    return;
  }

  // Send the JPEG bytes to our API endpoint. The endpoint uploads to Storage
  // with the service-role client (no RLS) and updates thumbnail_path. This
  // avoids browser-side Storage auth issues that surfaced as "new row
  // violates row-level security policy".
  const form = new FormData();
  form.append("file", jpeg, "thumb.jpg");

  const res = await fetch(
    `/api/projects/${ctx.projectId}/drawings/${ctx.drawingId}/versions/${ctx.versionId}/thumbnail`,
    { method: "POST", body: form }
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    console.warn("[thumb-repair] server upload failed", res.status, body);
  }
}

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
  drawingId,
  versionId,
  projectId,
  pdfStoragePath,
}: PdfThumbnailProps) {
  // If we got here the server-side thumbnail is missing (DrawingCard picks the
  // <img> path whenever thumbnail_url is present). That means we MUST render
  // the PDF at least once per version to bake a JPEG back to Storage — the
  // IndexedDB cache alone won't help the next device. So: when the repair
  // context is fully present and we haven't baked this version yet in this
  // session, skip the IDB cache shortcut and force the PDF renderer.
  const needsServerBake =
    !!projectId &&
    !!drawingId &&
    !!versionId &&
    !repairedVersions.has(versionId);

  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [cachedDataUrl, setCachedDataUrl] = useState<string | null>(null);
  // Initial value already accounts for needsServerBake so we don't have to
  // setShowPdfRenderer inside an effect.
  const [showPdfRenderer, setShowPdfRenderer] = useState(
    !cacheKey || needsServerBake
  );
  const pageRef = useRef<HTMLDivElement>(null);

  // Try to load cached thumbnail (only if we don't need to bake).
  useEffect(() => {
    if (!cacheKey || needsServerBake) return;

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
  }, [cacheKey, needsServerBake]);

  function handleRenderSuccess() {
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

    // Lazy-repair: if this drawing has no server-side thumbnail yet, bake
    // the rendered canvas into a JPEG and ship it to the API which uploads
    // via service role. Best-effort; failures log only.
    if (projectId && drawingId && versionId) {
      repairServerThumbnail(canvas, { projectId, drawingId, versionId })
        .catch((err) => {
          console.warn("[thumb-repair] uncaught error", err);
        });
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

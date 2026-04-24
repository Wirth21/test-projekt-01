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
import { uploadThumbnail } from "@/lib/thumbnails/upload";

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
    pdfStoragePath: string;
  }
) {
  if (repairedVersions.has(ctx.versionId)) {
    console.log("[thumb-repair] skipped (already attempted this session)", ctx.versionId);
    return;
  }
  repairedVersions.add(ctx.versionId);

  console.log("[thumb-repair] starting for version", ctx.versionId, "drawing", ctx.drawingId);

  const jpeg = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8);
  });
  if (!jpeg) {
    console.warn("[thumb-repair] canvas.toBlob returned null");
    return;
  }
  console.log("[thumb-repair] jpeg blob size", jpeg.size);

  const path = await uploadThumbnail(ctx.pdfStoragePath, jpeg);
  if (!path) {
    console.warn("[thumb-repair] uploadThumbnail returned null — Storage write failed");
    return;
  }
  console.log("[thumb-repair] uploaded to Storage at", path);

  const res = await fetch(
    `/api/projects/${ctx.projectId}/drawings/${ctx.drawingId}/versions/${ctx.versionId}/thumbnail`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thumbnail_path: path }),
    }
  );
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.warn("[thumb-repair] PATCH failed", res.status, body);
    return;
  }
  console.log("[thumb-repair] DB updated", body);
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
  const [loaded, setLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [cachedDataUrl, setCachedDataUrl] = useState<string | null>(null);
  const [showPdfRenderer, setShowPdfRenderer] = useState(!cacheKey);
  const pageRef = useRef<HTMLDivElement>(null);

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
    !!pdfStoragePath &&
    !repairedVersions.has(versionId);

  // Try to load cached thumbnail (only if we don't need to bake).
  useEffect(() => {
    if (!cacheKey) return;
    if (needsServerBake) {
      setShowPdfRenderer(true);
      return;
    }

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
    // the rendered canvas into a JPEG and upload it so the next viewer
    // skips the slow PDF re-render path. Best-effort; failures log only.
    if (projectId && drawingId && versionId && pdfStoragePath) {
      repairServerThumbnail(canvas, {
        projectId,
        drawingId,
        versionId,
        pdfStoragePath,
      }).catch((err) => {
        console.warn("[thumb-repair] uncaught error", err);
      });
    } else {
      console.warn("[thumb-repair] missing context, skipping", {
        projectId,
        drawingId,
        versionId,
        pdfStoragePath,
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

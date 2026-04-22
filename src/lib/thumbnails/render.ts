"use client";

import { pdfjs } from "react-pdf";

// react-pdf needs its worker configured; keep this single source of truth so
// every consumer (PdfThumbnail, upload helpers) shares the same URL.
if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();
}

export const THUMBNAIL_WIDTH_PX = 800;
export const THUMBNAIL_JPEG_QUALITY = 0.8;

/**
 * Render page 1 of a PDF file to a JPEG blob suitable for use as a thumbnail.
 * Runs entirely in the browser — no server round trip.
 *
 * Returns null if the PDF can't be parsed (corrupt, encrypted, …); callers
 * should treat that as a soft failure and continue without a thumbnail.
 */
export async function renderPdfThumbnail(
  file: Blob | ArrayBuffer,
  opts: { width?: number; quality?: number } = {}
): Promise<Blob | null> {
  const width = opts.width ?? THUMBNAIL_WIDTH_PX;
  const quality = opts.quality ?? THUMBNAIL_JPEG_QUALITY;

  try {
    const data = file instanceof Blob ? await file.arrayBuffer() : file;
    const pdf = await pdfjs.getDocument({ data }).promise;
    const page = await pdf.getPage(1);

    const unscaledViewport = page.getViewport({ scale: 1 });
    const scale = width / unscaledViewport.width;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
    });
  } catch {
    return null;
  }
}

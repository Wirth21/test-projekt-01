"use client";

// pdfjs-dist references DOMMatrix at module-eval. Importing it eagerly from
// a module that ends up in the server bundle (via any "use client" page that
// transitively imports this file) crashes SSR with "DOMMatrix is not
// defined". We therefore load pdfjs *inside* the async render function, so
// the module is only ever evaluated in the browser.

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
  if (typeof window === "undefined") return null;

  const width = opts.width ?? THUMBNAIL_WIDTH_PX;
  const quality = opts.quality ?? THUMBNAIL_JPEG_QUALITY;

  try {
    const { pdfjs } = await import("react-pdf");
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();
    }

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

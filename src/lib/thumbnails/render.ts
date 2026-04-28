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
 * The `rotation` option is the user's delta on top of the PDF's intrinsic
 * /Rotate metadata (same semantic as the viewer). Omit or pass 0 to respect
 * intrinsic rotation only. Returns null if the PDF can't be parsed.
 */
export async function renderPdfThumbnail(
  file: Blob | ArrayBuffer,
  opts: { width?: number; quality?: number; rotation?: number } = {}
): Promise<Blob | null> {
  if (typeof window === "undefined") return null;

  const width = opts.width ?? THUMBNAIL_WIDTH_PX;
  const quality = opts.quality ?? THUMBNAIL_JPEG_QUALITY;
  const delta = ((opts.rotation ?? 0) % 360 + 360) % 360;

  try {
    const { pdfjs } = await import("react-pdf");
    // Always set — Turbopack creates a separate module instance for the
    // dynamic import, so the static workerSrc set in the viewer doesn't
    // carry over here. Same-origin /public path works in both.
    pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs-worker.min.mjs";

    const data = file instanceof Blob ? await file.arrayBuffer() : file;
    const pdf = await pdfjs.getDocument({ data }).promise;
    const page = await pdf.getPage(1);

    // Combine intrinsic rotation with user delta so the thumbnail matches
    // what the viewer shows on screen.
    const intrinsic = ((page.rotate ?? 0) % 360 + 360) % 360;
    const absoluteRotation = (intrinsic + delta) % 360;

    const unscaledViewport = page.getViewport({ scale: 1, rotation: absoluteRotation });
    const scale = width / unscaledViewport.width;
    const viewport = page.getViewport({ scale, rotation: absoluteRotation });

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

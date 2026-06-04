"use client";

/**
 * PROJ-33 — Offscreen page renderer for the version compare view.
 *
 * Same approach as lib/thumbnails/render.ts: pdfjs is imported *inside* the
 * async function (it touches DOMMatrix at module-eval and would crash Next 16
 * Turbopack SSR otherwise), and the worker is re-pointed at the /public copy
 * because the dynamic import gets its own module instance.
 *
 * Renders page 1 onto a fresh canvas at the given target width (white
 * background, intrinsic rotation applied) and returns it for compositing.
 */
export async function renderPageToCanvas(
  data: ArrayBuffer,
  opts: { width: number; pageNumber?: number } = { width: 1400 }
): Promise<HTMLCanvasElement | null> {
  if (typeof window === "undefined") return null;

  const { pdfjs } = await import("react-pdf");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdfjs-worker.min.mjs";

  const pdf = await pdfjs.getDocument({ data }).promise;
  const page = await pdf.getPage(opts.pageNumber ?? 1);

  const intrinsic = (((page.rotate ?? 0) % 360) + 360) % 360;
  const unscaled = page.getViewport({ scale: 1, rotation: intrinsic });
  const scale = opts.width / unscaled.width;
  const viewport = page.getViewport({ scale, rotation: intrinsic });

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Plans can have a transparent background — paint white first so the ink
  // luminance math (and the red/blue tinting) has a clean base.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas;
}

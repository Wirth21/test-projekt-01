"use client";

// Lazy-import pdf-lib in the functions below so the large dependency never
// shows up in the server bundle when a page happens to touch this module.

/** Returns the number of pages in a PDF blob. */
export async function getPdfPageCount(file: Blob | ArrayBuffer): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = file instanceof Blob ? await file.arrayBuffer() : file;
  const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return pdf.getPageCount();
}

/**
 * Split a multi-page PDF into one Blob per page. Each output is a proper
 * single-page PDF (not a rasterized image), so text/vectors stay intact.
 * The filenames are derived from the source: "foo.pdf" → "foo (Seite 1).pdf".
 */
export async function splitPdfToPages(
  file: File
): Promise<{ blob: Blob; suggestedName: string; pageIndex: number }[]> {
  const { PDFDocument } = await import("pdf-lib");
  const bytes = await file.arrayBuffer();
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const pageCount = source.getPageCount();

  const baseName = file.name.replace(/\.pdf$/i, "");
  const results: { blob: Blob; suggestedName: string; pageIndex: number }[] = [];

  for (let i = 0; i < pageCount; i++) {
    const out = await PDFDocument.create();
    const [copied] = await out.copyPages(source, [i]);
    out.addPage(copied);
    const outBytes = await out.save();
    // Re-wrap the copy in a plain ArrayBuffer so TypeScript stops complaining
    // about SharedArrayBuffer possibilities from the subarray view.
    const copy = outBytes.slice().buffer;
    const blob = new Blob([copy], { type: "application/pdf" });
    results.push({
      blob,
      suggestedName: `${baseName} (Seite ${i + 1}).pdf`,
      pageIndex: i,
    });
  }

  return results;
}

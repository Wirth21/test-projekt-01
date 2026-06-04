/**
 * PROJ-26 — Print a drawing's PDF.
 *
 * We print the *original* PDF bytes (the same signed URL / offline blob the
 * viewer already loads). Markers live in a separate HTML overlay, so the
 * printout is automatically the clean plan — no pins, full vector quality.
 *
 * Strategy:
 *  - Always go through a SAME-ORIGIN blob URL. A cross-origin URL inside an
 *    iframe makes `iframe.contentWindow.print()` throw a SecurityError, so we
 *    fetch the bytes first. (An offline `blob:` source is reused as-is.)
 *  - Desktop (fine pointer): load the blob into a hidden iframe and trigger the
 *    native print dialog. Cleaned up on `afterprint` or a safety timeout.
 *  - Touch / mobile (coarse pointer): iframe printing is unreliable there, so
 *    we open the PDF in a new tab and let the OS share/print sheet take over.
 *    The tab is opened synchronously inside the click gesture to dodge popup
 *    blockers, then pointed at the blob once it's ready.
 *
 * Throws if the PDF can't be fetched, so callers can surface a toast.
 */
export async function printPdf(source: string): Promise<void> {
  const isTouch =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  // Open the mobile/fallback tab synchronously so the popup blocker treats it
  // as user-initiated. Closed again if we don't end up needing it.
  let preOpened: Window | null = null;
  if (isTouch) {
    preOpened = window.open("", "_blank");
  }

  let blobUrl: string;
  let createdBlob = false;
  try {
    const resolved = await toBlobUrl(source);
    blobUrl = resolved.url;
    createdBlob = resolved.created;
  } catch (err) {
    preOpened?.close();
    throw err instanceof Error ? err : new Error("PDF fetch failed");
  }

  // Touch / mobile: hand off to a real browser tab.
  if (isTouch) {
    if (preOpened) {
      preOpened.location.href = blobUrl;
      // The tab is still loading the blob — revoke later, not now.
      if (createdBlob) scheduleRevoke(blobUrl);
    } else {
      // Popup was blocked: best-effort same-tab navigation.
      window.location.href = blobUrl;
    }
    return;
  }

  // Desktop: hidden iframe + native print dialog.
  await printViaIframe(blobUrl, createdBlob);
}

function printViaIframe(blobUrl: string, revokeAfter: boolean): Promise<void> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    iframe.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";

    let finished = false;
    const cleanup = () => {
      if (finished) return;
      finished = true;
      // Delay teardown so the print dialog keeps the document alive while open.
      setTimeout(() => {
        iframe.remove();
        if (revokeAfter) URL.revokeObjectURL(blobUrl);
      }, 1000);
      resolve();
    };

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) throw new Error("no contentWindow");
        // afterprint fires when the dialog closes (Chrome/Firefox/Edge); the
        // safety timeout covers engines that never emit it.
        win.addEventListener("afterprint", cleanup);
        win.focus();
        win.print();
        setTimeout(cleanup, 60_000);
      } catch {
        // print() blocked or failed — fall back to a plain tab.
        window.open(blobUrl, "_blank");
        cleanup();
      }
    };
    iframe.onerror = () => {
      window.open(blobUrl, "_blank");
      cleanup();
    };

    iframe.src = blobUrl;
    document.body.appendChild(iframe);
  });
}

function scheduleRevoke(url: string, ms = 60_000) {
  setTimeout(() => URL.revokeObjectURL(url), ms);
}

/**
 * Resolve any PDF source (a signed http(s) URL or an offline `blob:` URL) to a
 * SAME-ORIGIN object URL. Returns whether a fresh object URL was created so the
 * caller can revoke it; a `blob:` source is reused as-is.
 *
 * Shared by print (PROJ-26) and the red-blue version compare (PROJ-33), which
 * both need same-origin bytes (iframe.print / canvas getImageData throw on a
 * cross-origin source).
 */
export async function toBlobUrl(
  source: string
): Promise<{ url: string; created: boolean }> {
  if (source.startsWith("blob:")) return { url: source, created: false };
  const res = await fetch(source);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  return { url: URL.createObjectURL(blob), created: true };
}

/**
 * Fetch a PDF source into a Blob. Used by the compare renderer (PROJ-33) which
 * needs the raw bytes for pdfjs `getDocument` + canvas pixel access. Works for
 * both signed URLs and `blob:` sources (same-origin fetch).
 */
export async function fetchPdfBlob(source: string): Promise<Blob> {
  const res = await fetch(source);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

/**
 * PROJ-28 — Open the original PDF in a new browser tab (the platform's native
 * PDF viewer). This is the "full resolution" path: vector rendering, unlimited
 * zoom, all pages, and no canvas-area limit — strictly better than any in-canvas
 * re-render and robust on mobile. Must run synchronously inside the click
 * gesture so the popup blocker treats it as user-initiated.
 *
 * Returns false if the popup was blocked so the caller can surface a hint.
 */
export function openOriginalPdf(source: string): boolean {
  const win = window.open(source, "_blank", "noopener,noreferrer");
  return Boolean(win);
}

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
    if (source.startsWith("blob:")) {
      blobUrl = source;
    } else {
      const res = await fetch(source);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      blobUrl = URL.createObjectURL(blob);
      createdBlob = true;
    }
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

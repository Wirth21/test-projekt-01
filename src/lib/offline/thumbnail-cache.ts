const THUMBNAIL_STORE = "thumbnails";

/**
 * Thumbnail cache using IndexedDB.
 * Stores small JPEG thumbnails (base64) for fast offline-capable rendering.
 */

// We need to add the thumbnails store to the DB schema.
// For now, use a separate simple IndexedDB database to avoid migration issues.
const THUMB_DB_NAME = "link2plan-thumbnails";
const THUMB_DB_VERSION = 1;

let thumbDbPromise: Promise<IDBDatabase> | null = null;

function getThumbDB(): Promise<IDBDatabase> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Not available on server"));
  }

  if (!thumbDbPromise) {
    thumbDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(THUMB_DB_NAME, THUMB_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("thumbnails")) {
          db.createObjectStore("thumbnails");
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return thumbDbPromise;
}

/** Get a cached thumbnail as a data URL */
export async function getCachedThumbnail(key: string): Promise<string | null> {
  try {
    const db = await getThumbDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("thumbnails", "readonly");
      const store = tx.objectStore("thumbnails");
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** Store a thumbnail as a data URL */
export async function cacheThumbnail(key: string, dataUrl: string): Promise<void> {
  try {
    const db = await getThumbDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("thumbnails", "readwrite");
      const store = tx.objectStore("thumbnails");
      store.put(dataUrl, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve(); // Silently fail
    });
  } catch {
    // Ignore
  }
}

/** Generate a thumbnail from a canvas element and cache it */
export function canvasToThumbnail(canvas: HTMLCanvasElement, maxWidth: number = 200): string {
  // Create a smaller canvas for the thumbnail
  const scale = maxWidth / canvas.width;
  const thumbCanvas = document.createElement("canvas");
  thumbCanvas.width = maxWidth;
  thumbCanvas.height = Math.round(canvas.height * scale);

  const ctx = thumbCanvas.getContext("2d");
  if (ctx) {
    ctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
  }

  // Convert to JPEG at 60% quality for small size (~10-30KB per thumbnail)
  return thumbCanvas.toDataURL("image/jpeg", 0.6);
}

/** Clear all cached thumbnails */
export async function clearThumbnails(): Promise<void> {
  try {
    const db = await getThumbDB();
    return new Promise((resolve) => {
      const tx = db.transaction("thumbnails", "readwrite");
      const store = tx.objectStore("thumbnails");
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // Ignore
  }
}

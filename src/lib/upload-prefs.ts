import type { DrawingStatus } from "@/lib/types/drawing";

/**
 * PROJ-30 — Upload defaults.
 *
 * The status select on the upload dialogs defaults to the *last status the
 * user picked* (remembered device-wide in localStorage), falling back to the
 * tenant's default status. Status IDs are tenant-specific, so a remembered ID
 * is always re-validated against the current status list before use.
 */

const LAST_STATUS_KEY = "link2plan:lastUploadStatusId";

export function getLastStatusId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_STATUS_KEY);
  } catch {
    return null;
  }
}

export function setLastStatusId(id: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(LAST_STATUS_KEY, id);
    else window.localStorage.removeItem(LAST_STATUS_KEY);
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

/** Today's date as `yyyy-mm-dd` (local), for an <input type="date">. */
export function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convert a `yyyy-mm-dd` value to an ISO timestamp at local noon (avoids the
 *  off-by-one-day shift that midnight-UTC conversions cause). */
export function dateInputToIso(value: string): string {
  const safe = value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : todayIso();
  return new Date(`${safe}T12:00:00`).toISOString();
}

/** Pick the default status id: last-used (if still valid) else tenant default. */
export function resolveDefaultStatusId(
  statuses: DrawingStatus[],
  tenantDefaultId: string | null
): string | null {
  const last = getLastStatusId();
  if (last && statuses.some((s) => s.id === last)) return last;
  return tenantDefaultId;
}

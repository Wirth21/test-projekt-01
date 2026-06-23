// Tracks which projects the user has explicitly made available offline via the
// "Projekt synchronisieren" button (ProjectSyncButton). Used to warn — when the
// user is offline — that the current project was never fully downloaded, so some
// drawings may be missing. A simple localStorage map { projectId: syncedAtMs }.

const KEY = "link2plan_synced_projects";

function readMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

/** Record that a project was fully synced for offline use (call after a sync). */
export function markProjectSynced(projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    const map = readMap();
    map[projectId] = Date.now();
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // quota / unavailable — best effort
  }
}

/** Whether the project has ever been synced for offline use on this device. */
export function isProjectSynced(projectId: string): boolean {
  return typeof readMap()[projectId] === "number";
}

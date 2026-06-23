"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CloudOff } from "lucide-react";
import { useSyncContext } from "./SyncProvider";
import { isProjectSynced } from "@/lib/offline/synced-projects";

/**
 * Warns the user, while offline, that the current project was never made fully
 * available offline (no "Projekt synchronisieren" run on this device). In that
 * case only previously-opened drawings are cached; the rest can't be loaded
 * without a connection. Stays hidden when online or when the project was synced.
 */
export function OfflineNotSyncedHint({ projectId }: { projectId: string }) {
  const ts = useTranslations("sync");
  const { isOnline } = useSyncContext();

  // localStorage is client-only, so initialise lazily (true on the server → no
  // hydration flash) and re-read whenever connectivity flips. Re-reading on the
  // online→offline transition catches a sync that happened earlier this session.
  const [synced, setSynced] = useState(() =>
    typeof window === "undefined" ? true : isProjectSynced(projectId)
  );
  const [prevOnline, setPrevOnline] = useState(isOnline);
  if (prevOnline !== isOnline) {
    setPrevOnline(isOnline);
    setSynced(isProjectSynced(projectId));
  }

  if (isOnline || synced) return null;

  return (
    <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <CloudOff className="h-4 w-4 mt-0.5 shrink-0" />
      <span>{ts("notSyncedOffline")}</span>
    </div>
  );
}

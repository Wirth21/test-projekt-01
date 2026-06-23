"use client";

import { useQuery } from "@tanstack/react-query";

// How often to poll the (tiny) change-detection fingerprint while the project
// tab is visible. React Query pauses the interval automatically when the tab is
// hidden (refetchIntervalInBackground defaults to false), so a backgrounded tab
// spends zero Supabase Free-plan IO.
const SIGNATURE_POLL_INTERVAL_MS = 90_000;

/**
 * Polls GET /api/projects/[id]/signature — a compact "max(updated_at)+count"
 * fingerprint over the project's drawings/markers/versions (see migration 043).
 * Callers compare the value to the one they last applied to decide whether the
 * heavy lists actually need refetching; ~99% of polls return an unchanged
 * value, so the app stays cache-first instead of refetching on a timer.
 */
export function useProjectSignature(projectId: string) {
  return useQuery({
    queryKey: ["project-signature", projectId],
    queryFn: async (): Promise<string> => {
      const res = await fetch(`/api/projects/${projectId}/signature`);
      if (!res.ok) throw new Error("Signatur konnte nicht geladen werden");
      const json = await res.json();
      return (json.signature as string) ?? "";
    },
    enabled: !!projectId,
    staleTime: 30_000,
    refetchInterval: SIGNATURE_POLL_INTERVAL_MS,
  });
}

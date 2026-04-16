"use client";

import { useQuery } from "@tanstack/react-query";
import type { DrawingStatus } from "@/lib/types/drawing";

export function useDrawingStatuses() {
  const {
    data: statuses = [],
    isLoading: loading,
    refetch,
  } = useQuery<DrawingStatus[]>({
    queryKey: ["drawing-statuses"],
    queryFn: async () => {
      const res = await fetch("/api/statuses");
      const json = await res.json();

      if (!res.ok) {
        console.warn("[use-drawing-statuses] Failed to fetch statuses:", json.error);
        return [];
      }

      return json.statuses ?? [];
    },
    staleTime: 5 * 60_000,
  });

  const defaultStatus = statuses.find((s) => s.is_default) ?? null;

  return { statuses, loading, defaultStatus, refetch };
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { DrawingStatus } from "@/lib/types/drawing";

export function useDrawingStatuses() {
  const [statuses, setStatuses] = useState<DrawingStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatuses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/statuses");
      const json = await res.json();

      if (!res.ok) {
        console.warn("[use-drawing-statuses] Failed to fetch statuses:", json.error);
        return;
      }

      setStatuses(json.statuses ?? []);
    } catch (err) {
      console.warn("[use-drawing-statuses] Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  const defaultStatus = statuses.find((s) => s.is_default) ?? null;

  return { statuses, loading, defaultStatus, refetch: fetchStatuses };
}

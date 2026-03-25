"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase";
import type {
  ActivityLogEntry,
  ActivityActionType,
} from "@/lib/types/activity";

interface UseActivityOptions {
  projectId: string;
  limit?: number;
}

interface UseActivityReturn {
  entries: ActivityLogEntry[];
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  fetchActivity: (filters?: ActivityFilters) => Promise<void>;
  loadMore: () => Promise<void>;
}

export interface ActivityFilters {
  actionTypes?: ActivityActionType[] | null;
  userId?: string | null;
}

const DEFAULT_LIMIT = 50;

export function useActivity({
  projectId,
  limit = DEFAULT_LIMIT,
}: UseActivityOptions): UseActivityReturn {
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentFilters, setCurrentFilters] = useState<ActivityFilters>({});

  const supabase = createClient();

  const fetchActivity = useCallback(
    async (filters?: ActivityFilters) => {
      setLoading(true);
      setError(null);
      setCurrentPage(1);
      const appliedFilters = filters ?? currentFilters;
      setCurrentFilters(appliedFilters);

      try {
        const params = new URLSearchParams({
          page: "1",
          limit: String(limit),
        });

        if (appliedFilters.actionTypes && appliedFilters.actionTypes.length > 0) {
          params.set("action_type", appliedFilters.actionTypes.join(","));
        }

        if (appliedFilters.userId) {
          params.set("user_id", appliedFilters.userId);
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          setError("Nicht authentifiziert");
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/projects/${projectId}/activity?${params.toString()}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Fehler ${res.status}`);
        }

        const data = await res.json();
        setEntries(data.entries ?? []);
        setHasMore((data.entries ?? []).length >= limit);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Aktivitäten konnten nicht geladen werden"
        );
      } finally {
        setLoading(false);
      }
    },
    [projectId, limit, supabase, currentFilters]
  );

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    const nextPage = currentPage + 1;

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(limit),
      });

      if (currentFilters.actionTypes && currentFilters.actionTypes.length > 0) {
        params.set("action_type", currentFilters.actionTypes.join(","));
      }

      if (currentFilters.userId) {
        params.set("user_id", currentFilters.userId);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoadingMore(false);
        return;
      }

      const res = await fetch(
        `/api/projects/${projectId}/activity?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!res.ok) {
        throw new Error(`Fehler ${res.status}`);
      }

      const data = await res.json();
      const newEntries = data.entries ?? [];
      setEntries((prev) => [...prev, ...newEntries]);
      setHasMore(newEntries.length >= limit);
      setCurrentPage(nextPage);
    } catch {
      // Silently fail on load-more; user can retry
    } finally {
      setLoadingMore(false);
    }
  }, [projectId, limit, currentPage, loadingMore, hasMore, currentFilters, supabase]);

  return {
    entries,
    loading,
    loadingMore,
    error,
    hasMore,
    fetchActivity,
    loadMore,
  };
}

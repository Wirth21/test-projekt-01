"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AdminProjectDeleteResult,
  AdminTenantProject,
} from "@/lib/types/admin";

const LIST_QUERY_KEY = ["admin", "projects", "list"] as const;

async function fetchAdminTenantProjects(): Promise<AdminTenantProject[]> {
  const res = await fetch("/api/admin/projects/list");
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? "Projekte konnten nicht geladen werden");
  }
  return (json.projects ?? []) as AdminTenantProject[];
}

async function deleteAdminTenantProject(
  projectId: string
): Promise<AdminProjectDeleteResult> {
  const res = await fetch(
    `/api/admin/projects/${encodeURIComponent(projectId)}`,
    { method: "DELETE" }
  );
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.error ?? "Projekt konnte nicht gelöscht werden");
  }
  return json as AdminProjectDeleteResult;
}

/**
 * Data hook for the admin "Projekte" tab.
 * Loads all tenant projects (active + archived) with aggregated counts
 * and exposes a mutation to hard-delete a project.
 */
export function useAdminTenantProjects() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: LIST_QUERY_KEY,
    queryFn: fetchAdminTenantProjects,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminTenantProject,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: LIST_QUERY_KEY });
      // Side-effects on other caches: the user's own project list
      // and activity log views should also refetch.
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const refetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  return {
    projects: query.data ?? [],
    loading: query.isLoading,
    error: query.error instanceof Error ? query.error.message : null,
    refetch,
    deleteProject: deleteMutation.mutateAsync,
    deleting: deleteMutation.isPending,
  };
}

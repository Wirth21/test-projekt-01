"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase";
import { useUser } from "@/components/providers/UserProvider";
import type { ProjectWithRole, ProjectMember } from "@/lib/types/project";
import type { CreateProjectInput, EditProjectInput } from "@/lib/validations/project";

// --- Query functions ---

type ProjectStatsRow = {
  project_id: string;
  drawing_count: number;
  marker_count: number;
  member_count: number;
};

async function fetchProjectStats(
  supabase: ReturnType<typeof createClient>,
  projectIds: string[]
) {
  const countMap = new Map<
    string,
    { pdf_count: number; marker_count: number; member_count: number }
  >();
  if (projectIds.length === 0) return countMap;

  // One batched RPC for ALL projects instead of one project_stats() call per
  // project (the previous N+1 Promise.all). The function LEFT JOINs over the
  // input ids, so every id comes back with a row (0 when empty).
  const { data } = await supabase.rpc("project_stats_batch", {
    p_project_ids: projectIds,
  });

  for (const r of (data ?? []) as ProjectStatsRow[]) {
    countMap.set(r.project_id, {
      pdf_count: r.drawing_count ?? 0,
      marker_count: r.marker_count ?? 0,
      member_count: r.member_count ?? 0,
    });
  }
  return countMap;
}

async function fetchActiveProjects(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ProjectWithRole[]> {
  const { data: memberships, error: memberError } = await supabase
    .from("project_members")
    .select("project_id, role")
    .eq("user_id", userId);

  if (memberError) throw new Error("Projekte konnten nicht geladen werden");

  const roleMap = new Map(
    (memberships ?? []).map((m) => [m.project_id, m.role as "owner" | "member" | "viewer"])
  );

  const { data, error: projectsError } = await supabase
    .from("projects")
    .select("*")
    .eq("is_archived", false)
    .order("updated_at", { ascending: false });

  if (projectsError) throw new Error("Projekte konnten nicht geladen werden");

  const projectIds = (data ?? []).map((p) => p.id);
  const countMap = await fetchProjectStats(supabase, projectIds);

  return (data || []).map((p) => {
    const memberRole = roleMap.get(p.id);
    return {
      ...p,
      role: memberRole ?? "viewer",
      isMember: memberRole !== undefined,
      pdf_count: countMap.get(p.id)?.pdf_count ?? 0,
      marker_count: countMap.get(p.id)?.marker_count ?? 0,
      member_count: countMap.get(p.id)?.member_count ?? 0,
    };
  });
}

async function fetchArchivedProjectsData(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ProjectWithRole[]> {
  const { data: memberships } = await supabase
    .from("project_members")
    .select("project_id, role")
    .eq("user_id", userId);

  const roleMap = new Map(
    (memberships ?? []).map((m) => [m.project_id, m.role as "owner" | "member" | "viewer"])
  );

  const { data: projectsData } = await supabase
    .from("projects")
    .select("*")
    .eq("is_archived", true)
    .order("updated_at", { ascending: false });

  const archivedIds = (projectsData || []).map((p) => p.id);
  const archivedCountMap = await fetchProjectStats(supabase, archivedIds);

  return (projectsData || []).map((p): ProjectWithRole => {
    const memberRole = roleMap.get(p.id);
    return {
      ...p,
      role: memberRole ?? "viewer",
      isMember: memberRole !== undefined,
      pdf_count: archivedCountMap.get(p.id)?.pdf_count ?? 0,
      marker_count: archivedCountMap.get(p.id)?.marker_count ?? 0,
      member_count: archivedCountMap.get(p.id)?.member_count ?? 0,
    };
  });
}

// --- Hook ---

export function useProjects() {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { userId } = useUser();

  // Active projects — list rarely changes during a session; mutations
  // invalidate explicitly. Disabled refetchOnWindowFocus is the global
  // default; no per-query override needed.
  const { data: projects = [], isLoading: loading, error: queryError } = useQuery({
    queryKey: ["projects", userId],
    queryFn: () => fetchActiveProjects(supabase, userId),
    staleTime: 5 * 60_000,
  });

  const error = queryError?.message ?? null;

  // Inactive projects (on-demand)
  const { data: inactiveData, isLoading: inactiveLoading, refetch: refetchInactive } = useQuery({
    queryKey: ["projects", "inactive"],
    queryFn: async (): Promise<ProjectWithRole[]> => {
      const res = await fetch("/api/projects/inactive");
      const json = await res.json();
      if (!res.ok) return [];
      return json.projects ?? [];
    },
    staleTime: 30_000,
    enabled: false, // only fetch on demand
  });
  const inactiveProjects = inactiveData ?? [];

  // Archived projects (on-demand)
  const { data: archivedData, isLoading: archivedLoading, refetch: refetchArchived } = useQuery({
    queryKey: ["projects", "archived", userId],
    queryFn: () => fetchArchivedProjectsData(supabase, userId),
    staleTime: 30_000,
    enabled: false, // only fetch on demand
  });
  const archivedProjects = archivedData ?? [];

  // --- Mutations ---

  const createProject = useCallback(async (input: CreateProjectInput) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Projekt konnte nicht erstellt werden");
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
    return json.project;
  }, [queryClient]);

  const updateProject = useCallback(async (id: string, input: EditProjectInput) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Projekt konnte nicht aktualisiert werden");
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [queryClient]);

  const archiveProject = useCallback(async (id: string) => {
    const res = await fetch(`/api/projects/${id}/archive`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Projekt konnte nicht archiviert werden");
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [queryClient]);

  const restoreProject = useCallback(async (id: string) => {
    const res = await fetch(`/api/projects/${id}/restore`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Projekt konnte nicht wiederhergestellt werden");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["projects", "archived"] }),
    ]);
  }, [queryClient]);

  const joinProject = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}/join`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["projects", "inactive"] }),
      ]);
      throw new Error(json.error ?? "Beitreten fehlgeschlagen");
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["projects", "inactive"] }),
    ]);
  }, [queryClient]);

  const leaveProject = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}/leave`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Verlassen fehlgeschlagen");
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [queryClient]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [queryClient]);

  return {
    projects,
    loading,
    error,
    inactiveProjects,
    inactiveLoading,
    archivedProjects,
    archivedLoading,
    createProject,
    updateProject,
    archiveProject,
    restoreProject,
    joinProject,
    leaveProject,
    fetchInactiveProjects: refetchInactive,
    fetchArchivedProjects: refetchArchived,
    refetch,
  };
}

// --- useProject (single project, for the detail page) ---

/**
 * Loads ONE project plus the caller's role/membership. Opening a project used
 * to mount useProjects(), which fetches the entire active project list AND its
 * per-project stats (N+1) just to `.find()` one row — a needless waterfall on
 * every project open. This mirrors fetchActiveProjects' semantics (non-archived,
 * RLS-visible, role from project_members) for a single id, without any stats.
 */
export function useProject(projectId: string) {
  const queryClient = useQueryClient();
  const supabase = createClient();
  const { userId } = useUser();

  const { data, isLoading: loading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async (): Promise<ProjectWithRole | null> => {
      const [{ data: membership }, { data: project }] = await Promise.all([
        supabase
          .from("project_members")
          .select("role")
          .eq("project_id", projectId)
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .eq("is_archived", false)
          .maybeSingle(),
      ]);
      if (!project) return null;
      const role = membership?.role as "owner" | "member" | "viewer" | undefined;
      return {
        ...project,
        role: role ?? "viewer",
        isMember: role !== undefined,
        // Counts are not shown on the detail header; keep the type shape.
        pdf_count: 0,
        marker_count: 0,
        member_count: 0,
      };
    },
    staleTime: 5 * 60_000,
    enabled: !!projectId,
  });

  const leaveProject = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/leave`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Verlassen fehlgeschlagen");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["projects"] }),
      queryClient.invalidateQueries({ queryKey: ["project", projectId] }),
    ]);
  }, [projectId, queryClient]);

  return { project: data ?? null, loading, leaveProject };
}

// --- useProjectMembers ---

export function useProjectMembers(projectId: string) {
  const queryClient = useQueryClient();

  const { data, isLoading: loading, error: queryError } = useQuery({
    queryKey: ["project-members", projectId],
    queryFn: async (): Promise<ProjectMember[]> => {
      const res = await fetch(`/api/projects/${projectId}/members`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Mitglieder konnten nicht geladen werden");
      return (json.members ?? []).map((m: ProjectMember) => ({
        ...m,
        role: m.role as "owner" | "member" | "viewer",
      }));
    },
    staleTime: 30_000,
    enabled: !!projectId,
  });

  const members = data ?? [];
  const error = queryError?.message ?? null;

  const inviteMember = useCallback(async (email: string) => {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Einladung konnte nicht gesendet werden");
    await queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [projectId, queryClient]);

  const removeMember = useCallback(async (memberId: string) => {
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Mitglied konnte nicht entfernt werden");
    await queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
    await queryClient.invalidateQueries({ queryKey: ["projects"] });
  }, [projectId, queryClient]);

  const changeRole = useCallback(async (memberId: string, role: "owner" | "member") => {
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Rolle konnte nicht geändert werden");
    await queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
  }, [projectId, queryClient]);

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["project-members", projectId] });
  }, [projectId, queryClient]);

  return {
    members,
    loading,
    error,
    inviteMember,
    removeMember,
    changeRole,
    refetch,
  };
}

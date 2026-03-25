"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { ProjectWithRole, ProjectMember } from "@/lib/types/project";
import type { CreateProjectInput, EditProjectInput } from "@/lib/validations/project";

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Nicht eingeloggt");
        setLoading(false);
        return;
      }

      // Get all project memberships for the current user
      const { data: memberships, error: memberError } = await supabase
        .from("project_members")
        .select("project_id, role")
        .eq("user_id", user.id);

      if (memberError) {
        setError("Projekte konnten nicht geladen werden");
        setLoading(false);
        return;
      }

      if (!memberships || memberships.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const projectIds = memberships.map((m) => m.project_id);

      // Fetch all projects the user is a member of
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .in("id", projectIds)
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });

      if (projectsError) {
        setError("Projekte konnten nicht geladen werden");
        setLoading(false);
        return;
      }

      // Count non-archived drawings per project
      const { data: drawingRows } = await supabase
        .from("drawings")
        .select("project_id")
        .in("project_id", projectIds)
        .eq("is_archived", false);

      const pdfCounts: Record<string, number> = {};
      if (drawingRows) {
        for (const row of drawingRows) {
          pdfCounts[row.project_id] = (pdfCounts[row.project_id] || 0) + 1;
        }
      }

      // Merge role info and pdf counts
      const roleMap = new Map(memberships.map((m) => [m.project_id, m.role]));
      const projectsWithRole: ProjectWithRole[] = (projectsData || []).map(
        (p) => ({
          ...p,
          role: (roleMap.get(p.id) as "owner" | "member") || "member",
          pdf_count: pdfCounts[p.id] ?? 0,
        })
      );

      setProjects(projectsWithRole);
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (input: CreateProjectInput) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Projekt konnte nicht erstellt werden");

    await fetchProjects();
    return json.project;
  };

  const updateProject = async (id: string, input: EditProjectInput) => {
    const res = await fetch(`/api/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Projekt konnte nicht aktualisiert werden");

    await fetchProjects();
  };

  const archiveProject = async (id: string) => {
    const res = await fetch(`/api/projects/${id}/archive`, { method: "POST" });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Projekt konnte nicht archiviert werden");

    await fetchProjects();
  };

  const restoreProject = async (id: string) => {
    const res = await fetch(`/api/projects/${id}/restore`, { method: "POST" });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Projekt konnte nicht wiederhergestellt werden");

    await fetchProjects();
    await fetchArchivedProjects();
  };

  // --- Inactive projects (projects the user is NOT a member of) ---
  const [inactiveProjects, setInactiveProjects] = useState<ProjectWithRole[]>([]);
  const [inactiveLoading, setInactiveLoading] = useState(false);

  const fetchInactiveProjects = useCallback(async () => {
    setInactiveLoading(true);
    try {
      const res = await fetch("/api/projects/inactive");
      const json = await res.json();
      if (!res.ok) {
        setInactiveLoading(false);
        return;
      }
      setInactiveProjects(json.projects ?? []);
    } catch {
      // silently fail
    } finally {
      setInactiveLoading(false);
    }
  }, []);

  const joinProject = async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}/join`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Beitreten fehlgeschlagen");
    await fetchProjects();
    await fetchInactiveProjects();
  };

  const leaveProject = async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}/leave`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Verlassen fehlgeschlagen");
    await fetchProjects();
  };

  const [archivedProjects, setArchivedProjects] = useState<ProjectWithRole[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);

  const fetchArchivedProjects = useCallback(async () => {
    setArchivedLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setArchivedLoading(false);
        return;
      }

      const { data: memberships } = await supabase
        .from("project_members")
        .select("project_id, role")
        .eq("user_id", user.id);

      if (!memberships || memberships.length === 0) {
        setArchivedProjects([]);
        setArchivedLoading(false);
        return;
      }

      const projectIds = memberships.map((m) => m.project_id);

      const { data: projectsData } = await supabase
        .from("projects")
        .select("*")
        .in("id", projectIds)
        .eq("is_archived", true)
        .order("updated_at", { ascending: false });

      const roleMap = new Map(memberships.map((m) => [m.project_id, m.role]));
      const result: ProjectWithRole[] = (projectsData || []).map((p) => ({
        ...p,
        role: (roleMap.get(p.id) as "owner" | "member") || "member",
      }));

      setArchivedProjects(result);
    } catch {
      // silently fail for archived list
    } finally {
      setArchivedLoading(false);
    }
  }, [supabase]);

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
    fetchInactiveProjects,
    fetchArchivedProjects,
    refetch: fetchProjects,
  };
}

export function useProjectMembers(projectId: string) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("project_members")
        .select(`
          id,
          project_id,
          user_id,
          role,
          joined_at,
          profiles:user_id (display_name, email)
        `)
        .eq("project_id", projectId)
        .order("joined_at", { ascending: true });

      if (fetchError) {
        setError("Mitglieder konnten nicht geladen werden");
        setLoading(false);
        return;
      }

      // Transform the joined profile data
      const transformed: ProjectMember[] = (data || []).map((m) => ({
        id: m.id,
        project_id: m.project_id,
        user_id: m.user_id,
        role: m.role as "owner" | "member",
        joined_at: m.joined_at,
        profile: m.profiles
          ? {
              display_name: (m.profiles as unknown as Record<string, unknown>).display_name as string | null,
              email: (m.profiles as unknown as Record<string, unknown>).email as string,
            }
          : undefined,
      }));

      setMembers(transformed);
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  }, [supabase, projectId]);

  useEffect(() => {
    if (projectId) {
      fetchMembers();
    }
  }, [projectId, fetchMembers]);

  const inviteMember = async (email: string) => {
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Einladung konnte nicht gesendet werden");

    await fetchMembers();
  };

  const removeMember = async (memberId: string) => {
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: "DELETE",
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Mitglied konnte nicht entfernt werden");

    await fetchMembers();
  };

  return {
    members,
    loading,
    error,
    inviteMember,
    removeMember,
    refetch: fetchMembers,
  };
}

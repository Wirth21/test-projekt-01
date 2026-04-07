"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { ProjectWithRole, ProjectMember } from "@/lib/types/project";
import type { CreateProjectInput, EditProjectInput } from "@/lib/validations/project";
import type { TenantRole } from "@/lib/types/admin";

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantRole, setTenantRole] = useState<TenantRole>("user");

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

      // Fetch tenant_role from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_role")
        .eq("id", user.id)
        .single();

      const role = (profile?.tenant_role as TenantRole) ?? "user";
      setTenantRole(role);
      const isReadOnly = role === "viewer" || role === "guest";

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

      const roleMap = new Map((memberships ?? []).map((m) => [m.project_id, m.role]));

      // RLS handles visibility: user/viewer see all tenant projects, guest sees only assigned
      // Just fetch all projects RLS allows
      let projectsData;
      let projectIds: string[];

      const { data, error: projectsError } = await supabase
        .from("projects")
        .select("*")
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });

      if (projectsError) {
        setError("Projekte konnten nicht geladen werden");
        setLoading(false);
        return;
      }
      projectsData = data;
      projectIds = (data ?? []).map((p) => p.id);

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

      // Count markers per project
      const { data: markerRows } = await supabase
        .from("markers")
        .select("project_id")
        .in("project_id", projectIds);

      const markerCounts: Record<string, number> = {};
      if (markerRows) {
        for (const row of markerRows) {
          markerCounts[row.project_id] = (markerCounts[row.project_id] || 0) + 1;
        }
      }

      // Count members per project
      const { data: memberRows } = await supabase
        .from("project_members")
        .select("project_id")
        .in("project_id", projectIds);

      const memberCounts: Record<string, number> = {};
      if (memberRows) {
        for (const row of memberRows) {
          memberCounts[row.project_id] = (memberCounts[row.project_id] || 0) + 1;
        }
      }

      // Merge role info, pdf counts, marker counts and member counts
      const projectsWithRole: ProjectWithRole[] = (projectsData || []).map(
        (p) => ({
          ...p,
          role: isReadOnly
            ? ("viewer" as const)
            : ((roleMap.get(p.id) as "owner" | "member" | undefined) ?? "viewer"),
          pdf_count: pdfCounts[p.id] ?? 0,
          marker_count: markerCounts[p.id] ?? 0,
          member_count: memberCounts[p.id] ?? 0,
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

      // Fetch memberships for role mapping
      const { data: memberships } = await supabase
        .from("project_members")
        .select("project_id, role")
        .eq("user_id", user.id);

      const roleMap = new Map((memberships ?? []).map((m) => [m.project_id, m.role]));

      // RLS handles visibility — fetch all archived projects the user can see
      const { data: projectsData } = await supabase
        .from("projects")
        .select("*")
        .eq("is_archived", true)
        .order("updated_at", { ascending: false });

      const result: ProjectWithRole[] = (projectsData || []).map((p) => ({
        ...p,
        role: (roleMap.get(p.id) as "owner" | "member" | undefined) ?? "viewer",
      }));

      setArchivedProjects(result);
    } catch {
      // silently fail for archived list
    } finally {
      setArchivedLoading(false);
    }
  }, [supabase]);

  const isReadOnly = tenantRole === "viewer" || tenantRole === "guest";

  return {
    projects,
    loading,
    error,
    tenantRole,
    isReadOnly,
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

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Mitglieder konnten nicht geladen werden");
        return;
      }

      setMembers(
        (json.members ?? []).map((m: ProjectMember & { profile?: { display_name: string | null; email: string } | null }) => ({
          ...m,
          role: m.role as "owner" | "member",
        }))
      );
    } catch {
      setError("Ein unerwarteter Fehler ist aufgetreten");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

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

  const changeRole = async (memberId: string, role: "owner" | "member") => {
    const res = await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Rolle konnte nicht geändert werden");

    await fetchMembers();
  };

  return {
    members,
    loading,
    error,
    inviteMember,
    removeMember,
    changeRole,
    refetch: fetchMembers,
  };
}

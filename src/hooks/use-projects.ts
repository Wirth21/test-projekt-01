"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { ProjectWithRole, ProjectMember } from "@/lib/types/project";
import type { CreateProjectInput, EditProjectInput } from "@/lib/validations/project";
import type { TenantRole } from "@/lib/types/admin";
import { cacheRecords, getCachedByTenant, getSyncMeta, setSyncMeta } from "@/lib/offline/db";

export function useProjects() {
  const [projects, setProjects] = useState<ProjectWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tenantRole, setTenantRole] = useState<TenantRole>("user");
  const tenantIdRef = useRef<string | null>(null);

  const supabase = createClient();

  const fetchProjects = useCallback(async () => {
    // Try to restore tenantId from localStorage if not set
    if (!tenantIdRef.current) {
      try {
        tenantIdRef.current = localStorage.getItem("link2plan_tenant_id");
      } catch { /* ignore */ }
    }

    // Try to load cached projects first for instant display
    try {
      if (tenantIdRef.current) {
        const cached = await getCachedByTenant<ProjectWithRole>("projects", tenantIdRef.current);
        if (cached.length > 0) {
          setProjects(cached);
          setLoading(false);
          // If offline, stop here
          if (typeof navigator !== "undefined" && !navigator.onLine) return;
          // Check if cache is fresh enough to skip network
          const meta = await getSyncMeta(`projects:${tenantIdRef.current}`);
          if (meta && Date.now() - meta.lastSynced < 30_000) return;
        }
      }
    } catch {
      // IndexedDB not available, continue with network
    }

    // If offline and no cache, show error
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setLoading(false);
      return;
    }

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

      // Fetch tenant_role and tenant_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_role, tenant_id")
        .eq("id", user.id)
        .single();

      const role = (profile?.tenant_role as TenantRole) ?? "user";
      setTenantRole(role);
      if (profile?.tenant_id) {
        tenantIdRef.current = profile.tenant_id;
        try { localStorage.setItem("link2plan_tenant_id", profile.tenant_id); } catch { /* ignore */ }
      }
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

      // Count drawings, markers, members per project using SECURITY DEFINER functions
      const counts = await Promise.all(
        projectIds.map(async (pid) => {
          const [drawingRes, markerRes, memberRes] = await Promise.all([
            supabase.rpc("project_drawing_count", { p_project_id: pid }),
            supabase.rpc("project_marker_count", { p_project_id: pid }),
            supabase.rpc("project_member_count", { p_project_id: pid }),
          ]);
          return {
            id: pid,
            pdf_count: drawingRes.data ?? 0,
            marker_count: markerRes.data ?? 0,
            member_count: memberRes.data ?? 0,
          };
        })
      );

      const countMap = new Map(counts.map((c) => [c.id, c]));

      // Merge role info, pdf counts, marker counts and member counts
      const projectsWithRole: ProjectWithRole[] = (projectsData || []).map(
        (p) => ({
          ...p,
          role: isReadOnly
            ? ("viewer" as const)
            : ((roleMap.get(p.id) as "owner" | "member" | undefined) ?? "viewer"),
          pdf_count: countMap.get(p.id)?.pdf_count ?? 0,
          marker_count: countMap.get(p.id)?.marker_count ?? 0,
          member_count: countMap.get(p.id)?.member_count ?? 0,
        })
      );

      setProjects(projectsWithRole);

      // Cache the result
      const tid = projectsWithRole[0]?.tenant_id;
      if (tid) {
        tenantIdRef.current = tid;
        try {
          await cacheRecords("projects", projectsWithRole as unknown as Record<string, unknown>[], tid);
          await setSyncMeta({ key: `projects:${tid}`, lastSynced: Date.now(), tenantId: tid });
        } catch {
          // Cache write failed silently
        }
      }
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

      // Fetch counts using SECURITY DEFINER functions
      const archivedIds = (projectsData || []).map((p) => p.id);
      const archivedCounts = await Promise.all(
        archivedIds.map(async (pid) => {
          const [drawingRes, markerRes, memberRes] = await Promise.all([
            supabase.rpc("project_drawing_count", { p_project_id: pid }),
            supabase.rpc("project_marker_count", { p_project_id: pid }),
            supabase.rpc("project_member_count", { p_project_id: pid }),
          ]);
          return {
            id: pid,
            pdf_count: drawingRes.data ?? 0,
            marker_count: markerRes.data ?? 0,
            member_count: memberRes.data ?? 0,
          };
        })
      );
      const archivedCountMap = new Map(archivedCounts.map((c) => [c.id, c]));

      const result: ProjectWithRole[] = (projectsData || []).map((p) => ({
        ...p,
        role: (roleMap.get(p.id) as "owner" | "member" | undefined) ?? "viewer",
        pdf_count: archivedCountMap.get(p.id)?.pdf_count ?? 0,
        marker_count: archivedCountMap.get(p.id)?.marker_count ?? 0,
        member_count: archivedCountMap.get(p.id)?.member_count ?? 0,
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

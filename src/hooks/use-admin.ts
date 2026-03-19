"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  AdminProfile,
  AdminUserProject,
  PendingUser,
  UserStatus,
} from "@/lib/types/admin";

// ---------- Pending Users ----------

export function usePendingUsers() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pending");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Laden");
      setUsers(json.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const approveUser = async (userId: string) => {
    const res = await fetch("/api/admin/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Freigabe fehlgeschlagen");
    await fetchPending();
    return json.user;
  };

  const rejectUser = async (userId: string) => {
    const res = await fetch("/api/admin/pending", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Ablehnung fehlgeschlagen");
    await fetchPending();
  };

  return { users, loading, error, approveUser, rejectUser, refetch: fetchPending };
}

// ---------- Admin Users ----------

export function useAdminUsers(search: string = "", statusFilter: string = "") {
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Laden");
      setUsers(json.users ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateUserStatus = async (userId: string, status: UserStatus) => {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Status konnte nicht geaendert werden");
    await fetchUsers();
    return json.user;
  };

  return { users, loading, error, updateUserStatus, refetch: fetchUsers };
}

// ---------- User Projects ----------

export function useUserProjects(userId: string | null) {
  const [projects, setProjects] = useState<AdminUserProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (!userId) {
      setProjects([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/projects`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Fehler beim Laden");
      setProjects(json.projects ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const addToProject = async (projectId: string) => {
    if (!userId) throw new Error("Kein Nutzer ausgewaehlt");
    const res = await fetch(`/api/admin/users/${userId}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Hinzufuegen fehlgeschlagen");
    await fetchProjects();
    return json.membership;
  };

  const removeFromProject = async (projectId: string) => {
    if (!userId) throw new Error("Kein Nutzer ausgewaehlt");
    const res = await fetch(`/api/admin/users/${userId}/projects`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Entfernen fehlgeschlagen");
    await fetchProjects();
  };

  return { projects, loading, error, addToProject, removeFromProject, refetch: fetchProjects };
}

// ---------- All Projects (for dropdown) ----------

export function useAdminProjects() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/projects");
        const json = await res.json();
        if (res.ok) setProjects(json.projects ?? []);
      } catch {
        // silently fail — dropdown will be empty
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return { projects, loading };
}

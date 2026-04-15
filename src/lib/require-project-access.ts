import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { isReadOnlyUser } from "@/lib/admin";

type ProjectRole = "owner" | "member";

interface ProjectAccessResult {
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  user: { id: string; email?: string };
  membership: { id: string; role: ProjectRole };
}

/**
 * Unified auth + project membership check for API routes.
 *
 * Verifies:
 * 1. User is authenticated
 * 2. User is a member of the given project (via RLS)
 * 3. Optionally: user has the required role (e.g. "owner")
 * 4. Optionally: user is not read-only (viewer/guest)
 *
 * Returns either { data } with the supabase client, user, and membership,
 * or { error } with a NextResponse to return immediately.
 */
export async function requireProjectAccess(
  projectId: string,
  options?: { requireRole?: "owner"; requireWrite?: boolean }
): Promise<{ data: ProjectAccessResult } | { error: NextResponse }> {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      error: NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      ),
    };
  }

  // Check write permission if required
  if (options?.requireWrite) {
    if (await isReadOnlyUser(supabase)) {
      return {
        error: NextResponse.json(
          { error: "Kein Schreibzugriff" },
          { status: 403 }
        ),
      };
    }
  }

  // Check project membership (RLS handles tenant isolation)
  const { data: membership } = await supabase
    .from("project_members")
    .select("id, role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    return {
      error: NextResponse.json(
        { error: "Kein Zugriff auf dieses Projekt" },
        { status: 403 }
      ),
    };
  }

  // Check role if required
  if (options?.requireRole === "owner" && membership.role !== "owner") {
    return {
      error: NextResponse.json(
        { error: "Nur Projektbesitzer haben Zugriff" },
        { status: 403 }
      ),
    };
  }

  return {
    data: {
      supabase,
      user: { id: user.id, email: user.email },
      membership: membership as { id: string; role: ProjectRole },
    },
  };
}

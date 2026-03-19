import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";

// GET /api/admin/users — list all users (admin only)
// Query params: ?search=term&status=active
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();

  const { isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const statusFilter = searchParams.get("status") ?? "";

  // Build the query — admins can see all profiles via RLS
  let query = supabase
    .from("profiles")
    .select("id, display_name, email, status, is_admin, created_at, updated_at")
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .limit(200);

  if (statusFilter && ["pending", "active", "disabled"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  if (search) {
    // Sanitize: strip PostgREST filter-syntax special characters before interpolation
    const sanitizedSearch = search.replace(/[.,()%_]/g, "");
    if (sanitizedSearch) {
      query = query.or(
        `display_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`
      );
    }
  }

  const { data: profiles, error: queryError } = await query;

  if (queryError) {
    return NextResponse.json(
      { error: "Nutzer konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  // For each user, get the count of projects they are a member of
  // Use a single query with project_members to avoid N+1
  const userIds = profiles?.map((p) => p.id) ?? [];

  let projectCounts: Record<string, number> = {};
  if (userIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("project_members")
      .select("user_id")
      .in("user_id", userIds);

    if (memberRows) {
      projectCounts = memberRows.reduce(
        (acc: Record<string, number>, row) => {
          acc[row.user_id] = (acc[row.user_id] || 0) + 1;
          return acc;
        },
        {}
      );
    }
  }

  const users = (profiles ?? []).map((p) => ({
    ...p,
    project_count: projectCounts[p.id] ?? 0,
  }));

  return NextResponse.json({ users });
}

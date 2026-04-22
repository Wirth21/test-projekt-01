import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getTenantContext } from "@/lib/tenant";

// GET /api/projects/inactive — list non-archived projects where the user is NOT a member
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  let tenantId: string;
  try {
    const ctx = await getTenantContext();
    tenantId = ctx.tenantId;
  } catch {
    return NextResponse.json({ error: "Tenant-Kontext nicht verfügbar" }, { status: 400 });
  }

  // Get all project IDs the user is already a member of
  const { data: memberships, error: memberError } = await supabase
    .from("project_members")
    .select("project_id")
    .eq("user_id", user.id);

  if (memberError) {
    return NextResponse.json(
      { error: "Mitgliedschaften konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  const memberProjectIds = (memberships || []).map((m) => m.project_id);

  // Fetch non-archived projects in this tenant that the user is NOT a member of
  let query = supabase
    .from("projects")
    .select("id, name, description, created_at, updated_at, is_archived, created_by, tenant_id")
    .eq("tenant_id", tenantId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(100);

  // Exclude projects the user is already a member of
  if (memberProjectIds.length > 0) {
    query = query.not("id", "in", `(${memberProjectIds.map((id) => id.replace(/[^a-f0-9-]/gi, "")).join(",")})`);
  }

  const { data: projects, error: projectsError } = await query;

  if (projectsError) {
    return NextResponse.json(
      { error: "Projekte konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  // Get counts using SECURITY DEFINER function (bypasses RLS) — one RPC per
  // project returns all three counts in a single round trip.
  type Stats = { drawing_count: number; marker_count: number; member_count: number };
  const projectsWithCount = await Promise.all(
    (projects || []).map(async (p) => {
      const { data } = await supabase.rpc("project_stats", { p_project_id: p.id });
      const stats = (data ?? null) as Stats | null;
      return {
        ...p,
        pdf_count: stats?.drawing_count ?? 0,
        marker_count: stats?.marker_count ?? 0,
        member_count: stats?.member_count ?? 0,
      };
    })
  );

  return NextResponse.json({ projects: projectsWithCount });
}

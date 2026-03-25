import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/activity — list activity log entries with pagination and filters
export async function GET(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Verify user is a project member (or admin — RLS handles this)
  const { data: membership, error: memberError } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  // Also check admin status for cross-project access
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.is_admin === true;

  if (memberError) {
    return NextResponse.json({ error: "Fehler bei der Berechtigungsprüfung" }, { status: 500 });
  }

  if (!membership && !isAdmin) {
    return NextResponse.json({ error: "Kein Zugriff auf dieses Projekt" }, { status: 403 });
  }

  // Parse query parameters
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const actionType = searchParams.get("action_type");
  const userId = searchParams.get("user_id");

  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from("activity_log")
    .select("*", { count: "exact" })
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (actionType) {
    query = query.eq("action_type", actionType);
  }

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data: entries, error: fetchError, count } = await query;

  if (fetchError) {
    return NextResponse.json({ error: "Änderungsprotokoll konnte nicht geladen werden" }, { status: 500 });
  }

  return NextResponse.json({
    entries: entries ?? [],
    pagination: {
      page,
      limit,
      total: count ?? 0,
      totalPages: Math.ceil((count ?? 0) / limit),
    },
  });
}

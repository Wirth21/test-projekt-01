import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";

// GET /api/admin/projects — list all projects (admin only, for dropdown selection)
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  const { data: projects, error: queryError } = await supabase
    .from("projects")
    .select("id, name, is_archived, created_at")
    .eq("is_archived", false)
    .order("name", { ascending: true })
    .limit(500);

  if (queryError) {
    return NextResponse.json(
      { error: "Projekte konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ projects: projects ?? [] });
}

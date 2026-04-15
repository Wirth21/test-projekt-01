import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getTenantContext } from "@/lib/tenant";
import { z } from "zod";

const querySchema = z.object({
  projectId: z.string().uuid("Ungültige Projekt-ID"),
});

// GET /api/users/available?projectId=[id] — users not yet members of the project
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Parse and validate query params
  const { searchParams } = new URL(request.url);
  const queryResult = querySchema.safeParse({
    projectId: searchParams.get("projectId"),
  });

  if (!queryResult.success) {
    return NextResponse.json(
      { error: "Ungültige oder fehlende projectId", details: queryResult.error.flatten() },
      { status: 400 }
    );
  }

  const { projectId } = queryResult.data;
  let tenantId: string;
  try {
    const ctx = await getTenantContext();
    tenantId = ctx.tenantId;
  } catch {
    return NextResponse.json({ error: "Tenant-Kontext nicht verfügbar" }, { status: 400 });
  }

  // Verify the project exists in this tenant
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("tenant_id", tenantId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  // Get existing member user IDs for this project
  const { data: members, error: membersError } = await supabase
    .from("project_members")
    .select("user_id")
    .eq("project_id", projectId);

  if (membersError) {
    return NextResponse.json(
      { error: "Mitglieder konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  const memberUserIds = (members || []).map((m) => m.user_id);

  // Fetch all active profiles in this tenant, excluding existing members
  let query = supabase
    .from("profiles")
    .select("id, display_name, email")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("display_name", { ascending: true })
    .limit(200);

  if (memberUserIds.length > 0) {
    query = query.not("id", "in", `(${memberUserIds.map((id) => id.replace(/[^a-f0-9-]/gi, "")).join(",")})`);
  }

  const { data: profiles, error: profilesError } = await query;

  if (profilesError) {
    return NextResponse.json(
      { error: "Nutzer konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ users: profiles || [] });
}

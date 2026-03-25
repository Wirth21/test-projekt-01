import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getTenantContext } from "@/lib/tenant";
import { z } from "zod";

const paramsSchema = z.object({
  id: z.string().uuid("Ungültige Projekt-ID"),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/leave — user leaves a project (not allowed for owner)
export async function POST(_request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

  // Validate project ID format
  const paramResult = paramsSchema.safeParse({ id: projectId });
  if (!paramResult.success) {
    return NextResponse.json(
      { error: "Ungültige Projekt-ID" },
      { status: 400 }
    );
  }

  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  const { tenantId } = await getTenantContext();

  // Check project exists and belongs to tenant
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, tenant_id")
    .eq("id", projectId)
    .eq("tenant_id", tenantId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  // Find the user's membership
  const { data: membership, error: membershipError } = await supabase
    .from("project_members")
    .select("id, role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .single();

  if (membershipError || !membership) {
    return NextResponse.json(
      { error: "Du bist kein Mitglied dieses Projekts" },
      { status: 400 }
    );
  }

  // Owners cannot leave their own project
  if (membership.role === "owner") {
    return NextResponse.json(
      { error: "Der Projektersteller kann das Projekt nicht verlassen" },
      { status: 403 }
    );
  }

  // Delete the membership (RLS policy "Members can leave project" allows self-removal)
  const { error: deleteError } = await supabase
    .from("project_members")
    .delete()
    .eq("id", membership.id);

  if (deleteError) {
    return NextResponse.json(
      { error: "Verlassen fehlgeschlagen", detail: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

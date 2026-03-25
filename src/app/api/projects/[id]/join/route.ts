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

// POST /api/projects/[id]/join — user self-joins a project
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

  // Check project exists, belongs to tenant, and is not archived
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, is_archived, tenant_id")
    .eq("id", projectId)
    .eq("tenant_id", tenantId)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  if (project.is_archived) {
    return NextResponse.json(
      { error: "Archivierten Projekten kann nicht beigetreten werden" },
      { status: 400 }
    );
  }

  // Check if user is already a member
  const { data: existing } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json(
      { error: "Du bist bereits Mitglied dieses Projekts" },
      { status: 409 }
    );
  }

  // Insert membership (RLS policy "Users can self-join tenant projects" allows this)
  const { error: insertError } = await supabase
    .from("project_members")
    .insert({
      project_id: projectId,
      user_id: user.id,
      role: "member",
    });

  if (insertError) {
    // Handle unique constraint violation (race condition)
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Du bist bereits Mitglied dieses Projekts" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Beitreten fehlgeschlagen", detail: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

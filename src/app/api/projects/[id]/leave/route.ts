import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/superadmin";
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

  let tenantId: string;
  try {
    const ctx = await getTenantContext();
    tenantId = ctx.tenantId;
  } catch {
    return NextResponse.json({ error: "Tenant-Kontext nicht verfügbar" }, { status: 400 });
  }

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

  // Delete the membership using service role to bypass RLS
  let deleteError: { message: string } | null = null;
  try {
    const serviceClient = createServiceRoleClient();
    const result = await serviceClient
      .from("project_members")
      .delete()
      .eq("id", membership.id);
    deleteError = result.error;
  } catch {
    const result = await supabase
      .from("project_members")
      .delete()
      .eq("id", membership.id);
    deleteError = result.error;
  }

  if (deleteError) {
    return NextResponse.json(
      { error: "Verlassen fehlgeschlagen", detail: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

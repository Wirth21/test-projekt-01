import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/superadmin";
import { getAuthenticatedAdmin } from "@/lib/admin";
import {
  addUserToProjectSchema,
  removeUserFromProjectSchema,
} from "@/lib/validations/admin";

// GET /api/admin/users/[userId]/projects — list user's project memberships
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { userId } = await params;

  const { isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  // Verify user exists
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return NextResponse.json(
      { error: "Nutzer nicht gefunden" },
      { status: 404 }
    );
  }

  // Get all project memberships with project details using a join
  const { data: memberships, error: queryError } = await supabase
    .from("project_members")
    .select("id, project_id, role, joined_at, projects(name)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(100);

  if (queryError) {
    return NextResponse.json(
      { error: "Projekte konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  const projects = (memberships ?? []).map((m) => ({
    id: m.id,
    project_id: m.project_id,
    project_name: (m.projects as unknown as { name: string })?.name ?? "Unbekanntes Projekt",
    role: m.role,
    joined_at: m.joined_at,
  }));

  return NextResponse.json({ projects });
}

// POST /api/admin/users/[userId]/projects — add user to a project
export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { userId } = await params;

  const { isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const result = addUserToProjectSchema.safeParse({
    ...body as object,
    userId,
  });
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { projectId } = result.data;

  // Verify user exists
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .single();

  if (!profile) {
    return NextResponse.json(
      { error: "Nutzer nicht gefunden" },
      { status: 404 }
    );
  }

  // Verify project exists
  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", projectId)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: "Projekt nicht gefunden" },
      { status: 404 }
    );
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existingMember) {
    return NextResponse.json(
      { error: "Nutzer ist bereits Mitglied dieses Projekts" },
      { status: 409 }
    );
  }

  // Add user as member using service role to bypass RLS
  let membership: { id: string; project_id: string; role: string; joined_at: string } | null = null;
  let insertError: { message: string } | null = null;
  try {
    const serviceClient = createServiceRoleClient();
    const result = await serviceClient
      .from("project_members")
      .insert({
        project_id: projectId,
        user_id: userId,
        role: "member",
      })
      .select("id, project_id, role, joined_at")
      .single();
    membership = result.data;
    insertError = result.error;
  } catch {
    const result = await supabase
      .from("project_members")
      .insert({
        project_id: projectId,
        user_id: userId,
        role: "member",
      })
      .select("id, project_id, role, joined_at")
      .single();
    membership = result.data;
    insertError = result.error;
  }

  if (insertError || !membership) {
    return NextResponse.json(
      { error: "Nutzer konnte nicht zum Projekt hinzugefuegt werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    membership: {
      ...membership,
      project_name: project.name,
    },
  }, { status: 201 });
}

// DELETE /api/admin/users/[userId]/projects — remove user from a project
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { userId } = await params;

  const { isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body" },
      { status: 400 }
    );
  }

  const result = removeUserFromProjectSchema.safeParse({
    ...body as object,
    userId,
  });
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { projectId } = result.data;

  // Find the membership
  const { data: membership, error: findError } = await supabase
    .from("project_members")
    .select("id, role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();

  if (findError || !membership) {
    return NextResponse.json(
      { error: "Mitgliedschaft nicht gefunden" },
      { status: 404 }
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
      { error: "Mitgliedschaft konnte nicht entfernt werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/superadmin";

/**
 * GET /api/admin/users/[userId]/export
 *
 * DSGVO Art. 20 - Admin-initiated data export on behalf of a tenant user.
 * Requires admin authentication. The target user must belong to the same tenant.
 * Uses service role client to bypass RLS and gather all user data.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { userId } = await params;

  // 1. Verify admin authentication
  const { user, isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin || !user) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  const serviceClient = createServiceRoleClient();

  try {
    // 2. Fetch admin's tenant_id
    const { data: adminProfile, error: adminProfileError } = await serviceClient
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (adminProfileError || !adminProfile) {
      return NextResponse.json(
        { error: "Admin-Profil konnte nicht geladen werden" },
        { status: 500 }
      );
    }

    // 3. Fetch target user's profile and verify same tenant
    const { data: targetProfile, error: targetProfileError } = await serviceClient
      .from("profiles")
      .select("id, display_name, email, status, is_admin, tenant_id, created_at, updated_at")
      .eq("id", userId)
      .single();

    if (targetProfileError || !targetProfile) {
      return NextResponse.json(
        { error: "Nutzer nicht gefunden" },
        { status: 404 }
      );
    }

    if (targetProfile.tenant_id !== adminProfile.tenant_id) {
      return NextResponse.json(
        { error: "Nutzer gehoert nicht zu Ihrem Mandanten" },
        { status: 403 }
      );
    }

    // 4. Gather all user data (same scope as /api/account/export)

    // Tenant info
    const { data: tenant } = await serviceClient
      .from("tenants")
      .select("id, name, slug, plan, created_at")
      .eq("id", targetProfile.tenant_id)
      .single();

    // Project memberships
    const { data: memberships } = await serviceClient
      .from("project_members")
      .select(`
        id,
        role,
        joined_at,
        project_id,
        projects:project_id (
          id,
          name,
          description,
          created_at,
          is_archived
        )
      `)
      .eq("user_id", userId);

    // Drawings uploaded by this user
    const { data: drawings } = await serviceClient
      .from("drawings")
      .select("id, project_id, display_name, file_size, page_count, is_archived, created_at, updated_at")
      .eq("uploaded_by", userId);

    // Drawing versions created by this user
    const { data: drawingVersions } = await serviceClient
      .from("drawing_versions")
      .select("id, drawing_id, version_number, file_size, change_note, is_archived, created_at")
      .eq("created_by", userId);

    // Markers created by this user
    const { data: markers } = await serviceClient
      .from("markers")
      .select("id, drawing_id, target_drawing_id, project_id, name, page_number, x_percent, y_percent, created_at")
      .eq("created_by", userId);

    // Activity log entries for this user
    const { data: activityLog } = await serviceClient
      .from("activity_log")
      .select("id, project_id, action_type, target_type, target_id, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    const exportData = {
      export_info: {
        exported_at: new Date().toISOString(),
        user_id: userId,
        email: targetProfile.email,
        exported_by_admin: user.id,
        description:
          "Admin-Datenexport gemaess DSGVO Art. 20 (Recht auf Datenuebertragbarkeit). Enthaelt ausschliesslich personenbezogene Daten des betroffenen Nutzers.",
      },
      profile: targetProfile,
      tenant: tenant ?? null,
      project_memberships: memberships ?? [],
      drawings_uploaded: drawings ?? [],
      drawing_versions_created: drawingVersions ?? [],
      markers_created: markers ?? [],
      activity_log: activityLog ?? [],
    };

    const filename = `admin-datenexport-${userId}-${new Date().toISOString().slice(0, 10)}.json`;

    console.info(
      `[admin/export] Admin ${user.id} exported data for user ${userId} at ${new Date().toISOString()}`
    );

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[admin/export] Unexpected error:", err);
    return NextResponse.json(
      { error: "Datenexport konnte nicht erstellt werden" },
      { status: 500 }
    );
  }
}

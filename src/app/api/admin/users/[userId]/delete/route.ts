import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/superadmin";

/**
 * DELETE /api/admin/users/[userId]/delete
 *
 * DSGVO Art. 17 - Admin-initiated account deletion (soft-delete) on behalf of a tenant user.
 * Requires admin authentication. The target user must belong to the same tenant.
 * The admin cannot delete their own account through this endpoint.
 *
 * Soft-delete approach:
 * - Checks for owned projects (returns 409 if any)
 * - Removes project memberships
 * - Sets profile status to 'deleted', anonymizes display_name
 * - Does NOT sign the target user out (admin action, not user-initiated)
 * - Storage files are NOT deleted (DSGVO Art. 17 Abs. 3 exceptions)
 */
export async function DELETE(
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

  // 2. Prevent admin from deleting themselves
  if (userId === user.id) {
    return NextResponse.json(
      { error: "Sie koennen Ihr eigenes Konto nicht ueber diesen Endpunkt loeschen." },
      { status: 400 }
    );
  }

  const serviceClient = createServiceRoleClient();

  try {
    // 3. Fetch admin's tenant_id
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

    // 4. Fetch target user's profile and verify same tenant
    const { data: targetProfile, error: targetProfileError } = await serviceClient
      .from("profiles")
      .select("id, display_name, email, status, tenant_id")
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

    // 5. Check if already deleted
    if (targetProfile.status === "deleted") {
      return NextResponse.json(
        { error: "Dieses Konto wurde bereits geloescht" },
        { status: 409 }
      );
    }

    // 6. Check if the target user owns any projects
    const { data: ownedMemberships, error: ownerCheckError } = await serviceClient
      .from("project_members")
      .select("id, project_id, projects:project_id (name)")
      .eq("user_id", userId)
      .eq("role", "owner");

    if (ownerCheckError) {
      console.error("[admin/delete] Error checking owned projects:", ownerCheckError.message);
      return NextResponse.json(
        { error: "Kontozustand konnte nicht geprueft werden" },
        { status: 500 }
      );
    }

    if (ownedMemberships && ownedMemberships.length > 0) {
      const projectNames = ownedMemberships.map((m) => {
        const proj = m.projects as unknown as { name: string } | null;
        return proj?.name ?? "Unbekanntes Projekt";
      });
      return NextResponse.json(
        {
          error: "Konto kann nicht geloescht werden, solange der Nutzer Eigentuemer von Projekten ist. Bitte uebertragen Sie zuerst die Eigentuemerschaft.",
          owned_projects: projectNames,
        },
        { status: 409 }
      );
    }

    // 7. Remove all project memberships
    const { error: removeMembersError } = await serviceClient
      .from("project_members")
      .delete()
      .eq("user_id", userId);

    if (removeMembersError) {
      console.error("[admin/delete] Error removing memberships:", removeMembersError.message);
      return NextResponse.json(
        { error: "Projektmitgliedschaften konnten nicht entfernt werden" },
        { status: 500 }
      );
    }

    // 8. Audit trail: log the admin-initiated deletion
    console.info(
      `[admin/delete] DSGVO Art. 17 admin-initiated soft-delete: admin=${user.id} deleted user=${userId} email=${targetProfile.email} at ${new Date().toISOString()}`
    );

    // 9. Soft-delete: set profile status to 'deleted' and anonymize display name
    const { error: updateError } = await serviceClient
      .from("profiles")
      .update({
        status: "deleted",
        display_name: "Geloeschter Nutzer",
      })
      .eq("id", userId);

    if (updateError) {
      console.error("[admin/delete] Error updating profile status:", updateError.message);
      return NextResponse.json(
        { error: "Profilstatus konnte nicht aktualisiert werden" },
        { status: 500 }
      );
    }

    // NOTE: We do NOT sign the target user out here.
    // This is an admin action; the target user's session will fail
    // on next request when the middleware checks profile.status.

    return NextResponse.json({
      message: `Konto von ${targetProfile.email} wurde erfolgreich zur Loeschung markiert.`,
      deleted_user_id: userId,
    });
  } catch (err) {
    console.error("[admin/delete] Unexpected error:", err);
    return NextResponse.json(
      { error: "Kontolöschung konnte nicht durchgefuehrt werden" },
      { status: 500 }
    );
  }
}

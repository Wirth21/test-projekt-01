import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { updateDrawingStatusSchema } from "@/lib/validations/admin";
import { createServiceRoleClient } from "@/lib/superadmin";

// PATCH /api/admin/statuses/[statusId] — update a drawing status
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ statusId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { statusId } = await params;

  const { isAdmin, tenantId, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin || !tenantId) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body" },
      { status: 400 }
    );
  }

  const result = updateDrawingStatusSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const updates = result.data;
  const serviceClient = createServiceRoleClient();

  // If is_default is set to true, unset any other default first
  if (updates.is_default === true) {
    await serviceClient
      .from("drawing_statuses")
      .update({ is_default: false })
      .eq("tenant_id", tenantId)
      .eq("is_default", true);
  }

  const { data: status, error: updateError } = await serviceClient
    .from("drawing_statuses")
    .update(updates)
    .eq("id", statusId)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (updateError) {
    console.error("[admin/statuses] Update error:", updateError.message);
    return NextResponse.json(
      { error: "Status konnte nicht aktualisiert werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ status });
}

// DELETE /api/admin/statuses/[statusId] — delete a drawing status
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ statusId: string }> }
) {
  const supabase = await createServerSupabaseClient();
  const { statusId } = await params;

  const { isAdmin, tenantId, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin || !tenantId) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  const serviceClient = createServiceRoleClient();

  // Set all versions with this status_id to NULL first
  await serviceClient
    .from("drawing_versions")
    .update({ status_id: null })
    .eq("status_id", statusId);

  // Delete the status (scoped to tenant)
  const { error: deleteError } = await serviceClient
    .from("drawing_statuses")
    .delete()
    .eq("id", statusId)
    .eq("tenant_id", tenantId);

  if (deleteError) {
    console.error("[admin/statuses] Delete error:", deleteError.message);
    return NextResponse.json(
      { error: "Status konnte nicht gelöscht werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

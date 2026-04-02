import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createDrawingStatusSchema } from "@/lib/validations/admin";
import { createServiceRoleClient } from "@/lib/superadmin";

// GET /api/admin/statuses — list all drawing statuses for the tenant
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { isAdmin, tenantId, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin || !tenantId) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  const serviceClient = createServiceRoleClient();
  const { data: statuses, error: queryError } = await serviceClient
    .from("drawing_statuses")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true });

  if (queryError) {
    return NextResponse.json(
      { error: "Status konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ statuses: statuses ?? [] });
}

// POST /api/admin/statuses — create a new drawing status
export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

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

  const result = createDrawingStatusSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { name, color, is_default } = result.data;
  const serviceClient = createServiceRoleClient();

  // If is_default is true, unset any existing default first
  if (is_default) {
    await serviceClient
      .from("drawing_statuses")
      .update({ is_default: false })
      .eq("tenant_id", tenantId)
      .eq("is_default", true);
  }

  // Calculate sort_order as max(sort_order) + 1
  const { data: maxRow } = await serviceClient
    .from("drawing_statuses")
    .select("sort_order")
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sort_order = (maxRow?.sort_order ?? -1) + 1;

  const { data: status, error: insertError } = await serviceClient
    .from("drawing_statuses")
    .insert({
      tenant_id: tenantId,
      name,
      color,
      is_default: is_default ?? false,
      sort_order,
    })
    .select()
    .single();

  if (insertError) {
    console.error("[admin/statuses] Insert error:", insertError.message);
    return NextResponse.json(
      { error: "Status konnte nicht erstellt werden", detail: insertError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ status }, { status: 201 });
}

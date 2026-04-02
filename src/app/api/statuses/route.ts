import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/superadmin";

// GET /api/statuses — list drawing statuses for the current tenant
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // Get tenant_id from user profile
  const serviceClient = createServiceRoleClient();
  const { data: profile } = await serviceClient
    .from("profiles")
    .select("tenant_id")
    .eq("id", user.id)
    .single();

  if (!profile?.tenant_id) {
    return NextResponse.json({ error: "Tenant nicht gefunden" }, { status: 500 });
  }

  const { data: statuses, error: fetchError } = await serviceClient
    .from("drawing_statuses")
    .select("id, tenant_id, name, color, sort_order, is_default, created_at, updated_at")
    .eq("tenant_id", profile.tenant_id)
    .order("sort_order", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: "Status konnte nicht geladen werden" }, { status: 500 });
  }

  return NextResponse.json({ statuses: statuses ?? [] });
}

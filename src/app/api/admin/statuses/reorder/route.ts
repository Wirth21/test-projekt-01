import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createServiceRoleClient } from "@/lib/superadmin";
import { z } from "zod";

const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

// PUT /api/admin/statuses/reorder — update sort_order for all statuses
export async function PUT(request: Request) {
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
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = reorderSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { ids } = result.data;
  const serviceClient = createServiceRoleClient();

  // Update sort_order for each status in the given order
  const updates = ids.map((id, index) =>
    serviceClient
      .from("drawing_statuses")
      .update({ sort_order: index })
      .eq("id", id)
      .eq("tenant_id", tenantId)
  );

  const results = await Promise.all(updates);
  const failed = results.some((r) => r.error);

  if (failed) {
    return NextResponse.json({ error: "Reihenfolge konnte nicht gespeichert werden" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

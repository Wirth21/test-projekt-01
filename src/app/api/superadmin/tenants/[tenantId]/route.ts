import { NextResponse } from "next/server";
import {
  getAuthenticatedSuperadmin,
  createServiceRoleClient,
} from "@/lib/superadmin";
import { updateTenantSchema } from "@/lib/validations/superadmin";
import { RESERVED_SLUGS } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ tenantId: string }>;
}

// PATCH /api/superadmin/tenants/[tenantId] — update tenant
export async function PATCH(request: Request, { params }: RouteParams) {
  const { isSuperadmin, error } = await getAuthenticatedSuperadmin();
  if (!isSuperadmin) {
    return NextResponse.json(
      { error: error ?? "Forbidden" },
      { status: error === "Not authenticated" ? 401 : 403 }
    );
  }

  const { tenantId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const result = updateTenantSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const updates = result.data;
  const db = createServiceRoleClient();

  // If changing slug, check reserved + uniqueness
  if (updates.slug) {
    if (RESERVED_SLUGS.has(updates.slug)) {
      return NextResponse.json(
        { error: "This slug is reserved" },
        { status: 400 }
      );
    }

    const { data: existing } = await db
      .from("tenants")
      .select("id")
      .eq("slug", updates.slug)
      .neq("id", tenantId)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "A tenant with this slug already exists" },
        { status: 409 }
      );
    }
  }

  const { data: tenant, error: updateError } = await db
    .from("tenants")
    .update(updates)
    .eq("id", tenantId)
    .select("id, name, slug, plan, is_active")
    .single();

  if (updateError || !tenant) {
    return NextResponse.json(
      { error: updateError?.message ?? "Tenant not found" },
      { status: updateError ? 500 : 404 }
    );
  }

  return NextResponse.json({ tenant });
}

// DELETE /api/superadmin/tenants/[tenantId] — deactivate tenant (soft delete)
export async function DELETE(_request: Request, { params }: RouteParams) {
  const { isSuperadmin, error } = await getAuthenticatedSuperadmin();
  if (!isSuperadmin) {
    return NextResponse.json(
      { error: error ?? "Forbidden" },
      { status: error === "Not authenticated" ? 401 : 403 }
    );
  }

  const { tenantId } = await params;
  const db = createServiceRoleClient();

  const { data: tenant, error: updateError } = await db
    .from("tenants")
    .update({ is_active: false })
    .eq("id", tenantId)
    .select("id, name, slug, is_active")
    .single();

  if (updateError || !tenant) {
    return NextResponse.json(
      { error: "Tenant not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ tenant });
}

import { NextResponse } from "next/server";
import {
  getAuthenticatedSuperadmin,
  createServiceRoleClient,
} from "@/lib/superadmin";
import { createTenantSchema } from "@/lib/validations/superadmin";
import { RESERVED_SLUGS } from "@/lib/tenant";

// GET /api/superadmin/tenants — list all tenants with usage stats
export async function GET() {
  const { isSuperadmin, error } = await getAuthenticatedSuperadmin();
  if (!isSuperadmin) {
    return NextResponse.json(
      { error: error ?? "Forbidden" },
      { status: error === "Not authenticated" ? 401 : 403 }
    );
  }

  const db = createServiceRoleClient();

  // Get all tenants
  const { data: tenants, error: tenantsError } = await db
    .from("tenants")
    .select("id, name, slug, plan, is_active, created_at")
    .order("created_at", { ascending: false });

  if (tenantsError) {
    return NextResponse.json(
      { error: "Failed to load tenants" },
      { status: 500 }
    );
  }

  // Get user counts per tenant
  const tenantIds = tenants?.map((t) => t.id) ?? [];

  let userCounts: Record<string, number> = {};
  let projectCounts: Record<string, number> = {};

  if (tenantIds.length > 0) {
    const [usersRes, projectsRes] = await Promise.all([
      db
        .from("profiles")
        .select("tenant_id")
        .in("tenant_id", tenantIds)
        .neq("status", "deleted"),
      db
        .from("projects")
        .select("tenant_id")
        .in("tenant_id", tenantIds),
    ]);

    if (usersRes.data) {
      userCounts = usersRes.data.reduce(
        (acc: Record<string, number>, row) => {
          acc[row.tenant_id] = (acc[row.tenant_id] || 0) + 1;
          return acc;
        },
        {}
      );
    }

    if (projectsRes.data) {
      projectCounts = projectsRes.data.reduce(
        (acc: Record<string, number>, row) => {
          acc[row.tenant_id] = (acc[row.tenant_id] || 0) + 1;
          return acc;
        },
        {}
      );
    }
  }

  const tenantsWithStats = (tenants ?? []).map((t) => ({
    ...t,
    user_count: userCounts[t.id] ?? 0,
    project_count: projectCounts[t.id] ?? 0,
  }));

  return NextResponse.json({ tenants: tenantsWithStats });
}

// POST /api/superadmin/tenants — create new tenant + initial admin user
export async function POST(request: Request) {
  const { isSuperadmin, error } = await getAuthenticatedSuperadmin();
  if (!isSuperadmin) {
    return NextResponse.json(
      { error: error ?? "Forbidden" },
      { status: error === "Not authenticated" ? 401 : 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const result = createTenantSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validation error", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { name, slug, plan, admin_email, admin_password, admin_name } =
    result.data;

  // Check reserved slugs
  if (RESERVED_SLUGS.has(slug)) {
    return NextResponse.json(
      { error: "This slug is reserved and cannot be used" },
      { status: 400 }
    );
  }

  const db = createServiceRoleClient();

  // Check slug uniqueness
  const { data: existing } = await db
    .from("tenants")
    .select("id")
    .eq("slug", slug)
    .single();

  if (existing) {
    return NextResponse.json(
      { error: "A tenant with this slug already exists" },
      { status: 409 }
    );
  }

  // Create tenant row
  const { data: tenant, error: tenantError } = await db
    .from("tenants")
    .insert({ name, slug, plan, is_active: true })
    .select("id")
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json(
      { error: tenantError?.message ?? "Failed to create tenant" },
      { status: 500 }
    );
  }

  // Create admin user via Auth Admin API
  const { data: authData, error: authError } =
    await db.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: {
        display_name: admin_name,
        tenant_id: tenant.id,
      },
    });

  if (authError) {
    // Rollback: delete the tenant
    await db.from("tenants").delete().eq("id", tenant.id);

    if (authError.message?.includes("already been registered")) {
      return NextResponse.json(
        { error: "This email address is already registered" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: authError.message ?? "Failed to create admin user" },
      { status: 500 }
    );
  }

  // Set profile to active + is_admin
  const { error: profileError } = await db
    .from("profiles")
    .update({
      status: "active",
      display_name: admin_name,
      is_admin: true,
    })
    .eq("id", authData.user.id);

  if (profileError) {
    return NextResponse.json(
      {
        error:
          "Tenant and user created, but profile could not be updated",
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      tenant: { id: tenant.id, name, slug, plan },
      admin: {
        id: authData.user.id,
        email: admin_email,
        display_name: admin_name,
      },
    },
    { status: 201 }
  );
}

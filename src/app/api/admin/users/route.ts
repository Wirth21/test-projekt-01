import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getAuthenticatedAdmin } from "@/lib/admin";
import { createUserSchema } from "@/lib/validations/admin";
import { getTenantContext } from "@/lib/tenant";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { parsePagination, paginationMeta } from "@/lib/pagination";

// GET /api/admin/users — list all users (admin only)
// Query params: ?search=term&status=active
export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();

  const { isAdmin, error } = await getAuthenticatedAdmin(supabase);
  if (!isAdmin) {
    return NextResponse.json(
      { error: error ?? "Keine Admin-Berechtigung" },
      { status: error === "Nicht authentifiziert" ? 401 : 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const statusFilter = searchParams.get("status") ?? "";
  const { page, limit, from, to } = parsePagination(searchParams);

  // Build the query — admins can see all profiles via RLS
  let query = supabase
    .from("profiles")
    .select("id, display_name, email, status, is_admin, created_at, updated_at", { count: "exact", head: false })
    .neq("status", "deleted")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (statusFilter && ["pending", "active", "disabled"].includes(statusFilter)) {
    query = query.eq("status", statusFilter);
  }

  if (search) {
    // Sanitize: strip PostgREST filter-syntax special characters before interpolation
    const sanitizedSearch = search.replace(/[.,()%_]/g, "");
    if (sanitizedSearch) {
      query = query.or(
        `display_name.ilike.%${sanitizedSearch}%,email.ilike.%${sanitizedSearch}%`
      );
    }
  }

  const { data: profiles, error: queryError, count } = await query;

  if (queryError) {
    return NextResponse.json(
      { error: "Nutzer konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  // For each user, get the count of projects they are a member of
  // Use a single query with project_members to avoid N+1
  const userIds = profiles?.map((p) => p.id) ?? [];

  let projectCounts: Record<string, number> = {};
  if (userIds.length > 0) {
    const { data: memberRows } = await supabase
      .from("project_members")
      .select("user_id")
      .in("user_id", userIds);

    if (memberRows) {
      projectCounts = memberRows.reduce(
        (acc: Record<string, number>, row) => {
          acc[row.user_id] = (acc[row.user_id] || 0) + 1;
          return acc;
        },
        {}
      );
    }
  }

  const users = (profiles ?? []).map((p) => ({
    ...p,
    project_count: projectCounts[p.id] ?? 0,
  }));

  const total = count ?? 0;

  return NextResponse.json({
    users,
    pagination: paginationMeta(page, limit, total),
  });
}

// POST /api/admin/users — create a new user manually (admin only)
export async function POST(request: Request) {
  // Rate limit: 10 requests per minute
  const key = getRateLimitKey(request);
  const limiter = rateLimit(`admin-create-user:${key}`, 10, 60_000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte versuche es später erneut." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  const supabase = await createServerSupabaseClient();

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
    return NextResponse.json({ error: "Ungueltiger Request-Body" }, { status: 400 });
  }

  const result = createUserSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { email, password, display_name } = result.data;

  // Use service_role key to create users via Auth Admin API
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json(
      { error: "Server-Konfiguration unvollstaendig (Service Role Key fehlt)" },
      { status: 500 }
    );
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  );

  // Get tenant context for the new user
  const { tenantId } = await getTenantContext();

  // Create user in Supabase Auth (auto-confirms email)
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name, tenant_id: tenantId },
  });

  if (authError) {
    if (authError.message?.includes("already been registered")) {
      return NextResponse.json(
        { error: "Diese E-Mail-Adresse ist bereits registriert" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: authError.message ?? "Nutzer konnte nicht erstellt werden" },
      { status: 500 }
    );
  }

  // Set profile to active status (bypass pending) and update display_name
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({ status: "active", display_name })
    .eq("id", authData.user.id);

  if (profileError) {
    return NextResponse.json(
      { error: "Nutzer erstellt, aber Profil konnte nicht aktualisiert werden" },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { user: { id: authData.user.id, email, display_name } },
    { status: 201 }
  );
}

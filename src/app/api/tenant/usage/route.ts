import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getTenantContext } from "@/lib/tenant";
import { getTenantUsage } from "@/lib/check-limits";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import type { PlanType } from "@/lib/types/tenant";

// GET /api/tenant/usage — returns current tenant's usage stats + plan limits
export async function GET() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Nicht authentifiziert" },
      { status: 401 }
    );
  }

  let tenantId: string;
  try {
    const ctx = await getTenantContext();
    tenantId = ctx.tenantId;
  } catch {
    return NextResponse.json({ error: "Tenant-Kontext nicht verfügbar" }, { status: 400 });
  }

  // Fetch tenant plan
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) {
    return NextResponse.json(
      { error: "Tenant nicht gefunden" },
      { status: 404 }
    );
  }

  const plan = (tenant.plan as PlanType) ?? "free";
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const usage = await getTenantUsage(supabase, tenantId);

  return NextResponse.json({
    usage: {
      storageBytes: usage.storageBytes,
      userCount: usage.userCount,
      projectCount: usage.projectCount,
    },
    limits,
    plan,
  });
}

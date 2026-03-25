import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { inviteMemberSchema } from "@/lib/validations/project";
import { getTenantContext } from "@/lib/tenant";
import { getTenantUsage, getLimitsForPlan } from "@/lib/check-limits";
import type { PlanType } from "@/lib/types/tenant";
import { logActivity } from "@/lib/activity-log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/projects/[id]/members — invite a member by email (owner only)
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const result = inviteMemberSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { email } = result.data;

  // Check user limit for this tenant
  const { tenantId } = await getTenantContext();
  const { data: tenant } = await supabase
    .from("tenants")
    .select("plan")
    .eq("id", tenantId)
    .single();

  const plan = (tenant?.plan as PlanType) ?? "free";
  const limits = getLimitsForPlan(plan);
  const usage = await getTenantUsage(supabase, tenantId);

  if (usage.userCount >= limits.maxUsers) {
    return NextResponse.json(
      { error: "Nutzerlimit erreicht. Bitte Plan upgraden." },
      { status: 403 }
    );
  }

  // Self-invite check (case-insensitive)
  if (user.email?.toLowerCase() === email.toLowerCase()) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst einladen" }, { status: 400 });
  }

  // Find target user by email (case-insensitive)
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, display_name")
    .ilike("email", email)
    .limit(1);

  if (profileError || !profiles || profiles.length === 0) {
    return NextResponse.json({ error: "Kein Nutzer mit dieser E-Mail gefunden" }, { status: 404 });
  }

  const targetUser = profiles[0];

  // Check if already a member
  const { data: existing } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", targetUser.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "Dieser Nutzer ist bereits Mitglied des Projekts" }, { status: 409 });
  }

  const { error: inviteError } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id: targetUser.id, role: "member" });

  if (inviteError) {
    return NextResponse.json({ error: "Einladung konnte nicht gesendet werden" }, { status: 500 });
  }

  // Log activity: member invited
  await logActivity(supabase, {
    projectId,
    userId: user.id,
    actionType: "member.invited",
    targetType: "member",
    targetId: targetUser.id,
    metadata: {
      invited_email: targetUser.email,
      invited_name: targetUser.display_name || targetUser.email,
    },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}

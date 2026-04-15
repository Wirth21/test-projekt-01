import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/superadmin";
import { inviteMemberSchema } from "@/lib/validations/project";
import { getTenantContext } from "@/lib/tenant";
import { getTenantUsage, getLimitsForPlan } from "@/lib/check-limits";
import type { PlanType } from "@/lib/types/tenant";
import { logActivity } from "@/lib/activity-log";
import { requireProjectAccess } from "@/lib/require-project-access";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/projects/[id]/members — list project members
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

  const result = await requireProjectAccess(projectId);
  if ("error" in result) return result.error;
  const { supabase } = result.data;

  // Fetch members
  const { data: memberRows, error: fetchError } = await supabase
    .from("project_members")
    .select("id, project_id, user_id, role, joined_at")
    .eq("project_id", projectId)
    .order("joined_at", { ascending: true });

  if (fetchError) {
    console.error("[members/GET] fetchError:", fetchError.message);
    return NextResponse.json({ error: "Mitglieder konnten nicht geladen werden" }, { status: 500 });
  }

  // Fetch profiles separately (avoids RLS join issues)
  const userIds = (memberRows || []).map((m) => m.user_id);
  let profileMap: Record<string, { display_name: string | null; email: string }> = {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, email")
      .in("id", userIds);

    if (profiles) {
      for (const p of profiles) {
        profileMap[p.id] = { display_name: p.display_name, email: p.email };
      }
    }
  }

  const members = (memberRows || []).map((m) => ({
    id: m.id,
    project_id: m.project_id,
    user_id: m.user_id,
    role: m.role,
    joined_at: m.joined_at,
    profile: profileMap[m.user_id] ?? null,
  }));

  return NextResponse.json({ members });
}

// POST /api/projects/[id]/members — invite a member by email (owner only)
export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;

  const accessResult = await requireProjectAccess(projectId, { requireWrite: true });
  if ("error" in accessResult) return accessResult.error;
  const { supabase, user } = accessResult.data;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body" }, { status: 400 });
  }

  const parsed = inviteMemberSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email } = parsed.data;

  // Check user limit for this tenant
  let tenantId: string;
  try {
    const ctx = await getTenantContext();
    tenantId = ctx.tenantId;
  } catch {
    return NextResponse.json({ error: "Tenant-Kontext nicht verfügbar" }, { status: 400 });
  }
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

  // Insert membership using service role to bypass RLS
  let inviteError: { message: string } | null = null;
  try {
    const serviceClient = createServiceRoleClient();
    const result = await serviceClient
      .from("project_members")
      .insert({ project_id: projectId, user_id: targetUser.id, role: "member" });
    inviteError = result.error;
  } catch {
    const result = await supabase
      .from("project_members")
      .insert({ project_id: projectId, user_id: targetUser.id, role: "member" });
    inviteError = result.error;
  }

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

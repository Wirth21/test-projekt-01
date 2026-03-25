import { NextResponse } from "next/server";
import {
  getAuthenticatedSuperadmin,
  createServiceRoleClient,
} from "@/lib/superadmin";

// GET /api/superadmin/stats — platform-wide statistics
export async function GET() {
  const { isSuperadmin, error } = await getAuthenticatedSuperadmin();
  if (!isSuperadmin) {
    return NextResponse.json(
      { error: error ?? "Forbidden" },
      { status: error === "Not authenticated" ? 401 : 403 }
    );
  }

  const db = createServiceRoleClient();

  // Run counts in parallel
  const [tenantsRes, usersRes, projectsRes] = await Promise.all([
    db.from("tenants").select("id", { count: "exact", head: true }),
    db.from("profiles").select("id", { count: "exact", head: true }),
    db.from("projects").select("id", { count: "exact", head: true }),
  ]);

  return NextResponse.json({
    stats: {
      totalTenants: tenantsRes.count ?? 0,
      totalUsers: usersRes.count ?? 0,
      totalProjects: projectsRes.count ?? 0,
    },
  });
}

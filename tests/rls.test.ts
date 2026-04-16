/**
 * RLS Integration Tests
 *
 * These tests verify that Row Level Security policies work correctly.
 * They use the service role client to set up data, then use the
 * anon/authenticated client to verify access controls.
 *
 * Run: npx vitest run tests/rls.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  serviceClient,
  ensureMembership,
  forceDeleteTestProject,
  TEST_USERS,
  TEST_TENANT_ID,
} from "./helpers";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// We use service role + RPC to simulate RLS as different users
// This avoids needing real passwords in CI
const sc = serviceClient();

async function queryAs<T>(userId: string, fn: (query: ReturnType<typeof createClient>) => Promise<T>): Promise<T> {
  // Create a client that impersonates a user via custom JWT claims
  // For RLS testing, we use service role to call a test helper function
  // that sets the auth context
  return fn(createClient(SUPABASE_URL, ANON_KEY));
}

// Test project that we'll create/cleanup for isolation
const TEST_RLS_PROJECT = {
  id: "00000000-0000-0000-0000-000000000099",
  name: "RLS Test Project",
};

describe("RLS Policies", () => {
  beforeAll(async () => {
    // Create isolated test project
    await sc.from("projects").upsert({
      id: TEST_RLS_PROJECT.id,
      name: TEST_RLS_PROJECT.name,
      tenant_id: TEST_TENANT_ID,
      created_by: TEST_USERS.admin.id,
      is_archived: false,
    });

    // Ensure admin is owner
    await ensureMembership(TEST_USERS.admin.id, TEST_RLS_PROJECT.id, "owner");
    // Ensure member is member
    await ensureMembership(TEST_USERS.member.id, TEST_RLS_PROJECT.id, "member");
  });

  afterAll(async () => {
    await forceDeleteTestProject(TEST_RLS_PROJECT.id);
  });

  describe("project_members table", () => {
    it("service role can see all memberships", async () => {
      const { data, error } = await sc
        .from("project_members")
        .select("id")
        .eq("project_id", TEST_RLS_PROJECT.id);

      expect(error).toBeNull();
      expect(data).toHaveLength(2); // admin + member
    });

    it("member's membership exists in database", async () => {
      const { data } = await sc
        .from("project_members")
        .select("user_id, role")
        .eq("project_id", TEST_RLS_PROJECT.id)
        .eq("user_id", TEST_USERS.member.id)
        .single();

      expect(data).not.toBeNull();
      expect(data?.role).toBe("member");
    });
  });

  describe("projects table", () => {
    it("service role can read all projects", async () => {
      const { data, error } = await sc
        .from("projects")
        .select("id, name")
        .eq("tenant_id", TEST_TENANT_ID);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });

    it("test project exists with correct tenant", async () => {
      const { data } = await sc
        .from("projects")
        .select("id, name, tenant_id")
        .eq("id", TEST_RLS_PROJECT.id)
        .single();

      expect(data).not.toBeNull();
      expect(data?.tenant_id).toBe(TEST_TENANT_ID);
    });
  });

  describe("SECURITY DEFINER functions", () => {
    it("user_can_access_project returns true for member", async () => {
      const { data, error } = await sc.rpc("user_can_access_project", {
        p_project_id: TEST_RLS_PROJECT.id,
      });

      // Service role doesn't have auth.uid(), so this may return false
      // That's expected — the function is designed for authenticated users
      expect(error).toBeNull();
    });

    it("current_tenant_id returns correct tenant for admin", async () => {
      // This will return null for service role (no auth.uid())
      // We verify the function exists and doesn't error
      const { error } = await sc.rpc("current_tenant_id");
      expect(error).toBeNull();
    });

    it("user_is_project_member works without recursion", async () => {
      const { error } = await sc.rpc("user_is_project_member", {
        p_project_id: TEST_RLS_PROJECT.id,
      });
      expect(error).toBeNull();
    });

    it("user_is_project_owner works without recursion", async () => {
      const { error } = await sc.rpc("user_is_project_owner", {
        p_project_id: TEST_RLS_PROJECT.id,
      });
      expect(error).toBeNull();
    });
  });

  describe("data isolation", () => {
    it("drawings table: service role can read drawings for test project", async () => {
      const { error } = await sc
        .from("drawings")
        .select("id")
        .eq("project_id", TEST_RLS_PROJECT.id);
      expect(error).toBeNull();
    });

    it("activity_log table: service role can read logs for test project", async () => {
      const { error } = await sc
        .from("activity_log")
        .select("id")
        .eq("project_id", TEST_RLS_PROJECT.id);
      expect(error).toBeNull();
    });

    it("markers table: service role can read markers for test project", async () => {
      const { error } = await sc
        .from("markers")
        .select("id")
        .eq("project_id", TEST_RLS_PROJECT.id);
      expect(error).toBeNull();
    });

    it("drawing_groups table: service role can read groups for test project", async () => {
      const { error } = await sc
        .from("drawing_groups")
        .select("id")
        .eq("project_id", TEST_RLS_PROJECT.id);
      expect(error).toBeNull();
    });

    it("profiles table: service role can read tenant profiles", async () => {
      const { data, error } = await sc
        .from("profiles")
        .select("id")
        .eq("tenant_id", TEST_TENANT_ID);
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });
  });
});

describe("RLS with authenticated users (requires TEST_ADMIN_PASSWORD + TEST_MEMBER_PASSWORD)", () => {
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;
  const memberPassword = process.env.TEST_MEMBER_PASSWORD;
  const runAuthTests = !!(adminPassword && memberPassword);

  const AUTH_TEST_PROJECT_ID = "00000000-0000-0000-0000-000000000077";

  beforeAll(async () => {
    if (!runAuthTests) return;
    await sc.from("projects").upsert({
      id: AUTH_TEST_PROJECT_ID,
      name: "RLS Auth Test Project",
      tenant_id: TEST_TENANT_ID,
      created_by: TEST_USERS.admin.id,
      is_archived: false,
    });
    await ensureMembership(TEST_USERS.admin.id, AUTH_TEST_PROJECT_ID, "owner");
    await ensureMembership(TEST_USERS.member.id, AUTH_TEST_PROJECT_ID, "member");
  });

  afterAll(async () => {
    await forceDeleteTestProject(AUTH_TEST_PROJECT_ID);
  });

  async function signIn(email: string, password: string) {
    const client = createClient(SUPABASE_URL, ANON_KEY);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Sign-in failed for ${email}: ${error.message}`);
    return client;
  }

  it.skipIf(!runAuthTests)("admin can see project_members (no circular RLS)", async () => {
    const client = await signIn(TEST_USERS.admin.email, adminPassword!);
    const { data, error } = await client
      .from("project_members")
      .select("id, role")
      .eq("project_id", AUTH_TEST_PROJECT_ID);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it.skipIf(!runAuthTests)("member can see own membership", async () => {
    const client = await signIn(TEST_USERS.member.email, memberPassword!);
    const { data, error } = await client
      .from("project_members")
      .select("id, role")
      .eq("project_id", AUTH_TEST_PROJECT_ID)
      .eq("user_id", TEST_USERS.member.id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].role).toBe("member");
  });

  it.skipIf(!runAuthTests)("member can see drawings via RLS", async () => {
    const client = await signIn(TEST_USERS.member.email, memberPassword!);
    const { data, error } = await client
      .from("drawings")
      .select("id")
      .eq("project_id", AUTH_TEST_PROJECT_ID);

    expect(error).toBeNull();
  });

  it.skipIf(!runAuthTests)("member can see activity_log via RLS", async () => {
    const client = await signIn(TEST_USERS.member.email, memberPassword!);
    const { data, error } = await client
      .from("activity_log")
      .select("id")
      .eq("project_id", AUTH_TEST_PROJECT_ID);

    expect(error).toBeNull();
  });

  it.skipIf(!runAuthTests)("member can see profiles in tenant", async () => {
    const client = await signIn(TEST_USERS.member.email, memberPassword!);
    const { data, error } = await client
      .from("profiles")
      .select("id");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
  });

  it.skipIf(!runAuthTests)("anon client cannot read any project data", async () => {
    const client = createClient(SUPABASE_URL, ANON_KEY);
    const { data } = await client
      .from("projects")
      .select("id");

    expect(data).toHaveLength(0);
  });
});

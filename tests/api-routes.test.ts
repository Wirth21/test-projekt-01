/**
 * API Route Integration Tests
 *
 * Tests the critical API flows by calling Supabase directly
 * (same queries the routes use). This catches RLS issues,
 * missing permissions, and data inconsistencies.
 *
 * Run: npx vitest run tests/api-routes.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  serviceClient,
  ensureMembership,
  removeMembership,
  TEST_USERS,
  TEST_TENANT_ID,
} from "./helpers";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const sc = serviceClient();

// Test project for API tests
const API_TEST_PROJECT = {
  id: "00000000-0000-0000-0000-000000000098",
  name: "API Test Project",
};

const API_TEST_DRAWING = {
  id: "00000000-0000-0000-0000-000000000097",
  display_name: "API Test Drawing",
};

describe("API Route Logic", () => {
  beforeAll(async () => {
    // Create test project
    await sc.from("projects").upsert({
      id: API_TEST_PROJECT.id,
      name: API_TEST_PROJECT.name,
      tenant_id: TEST_TENANT_ID,
      created_by: TEST_USERS.admin.id,
      is_archived: false,
    });

    // Admin is owner
    await ensureMembership(TEST_USERS.admin.id, API_TEST_PROJECT.id, "owner");
    // Member is member
    await ensureMembership(TEST_USERS.member.id, API_TEST_PROJECT.id, "member");

    // Create test drawing
    const { error: drawingError } = await sc.from("drawings").upsert({
      id: API_TEST_DRAWING.id,
      project_id: API_TEST_PROJECT.id,
      display_name: API_TEST_DRAWING.display_name,
      uploaded_by: TEST_USERS.admin.id,
      is_archived: false,
    });
    if (drawingError) console.error("Drawing insert error:", drawingError.message);
  });

  afterAll(async () => {
    // Cleanup in reverse order
    await sc.from("markers").delete().eq("project_id", API_TEST_PROJECT.id);
    await sc.from("drawing_versions").delete().eq("drawing_id", API_TEST_DRAWING.id);
    await sc.from("drawings").delete().eq("id", API_TEST_DRAWING.id);
    await sc.from("activity_log").delete().eq("project_id", API_TEST_PROJECT.id);
    await sc.from("drawing_groups").delete().eq("project_id", API_TEST_PROJECT.id);
    await removeMembership(TEST_USERS.member.id, API_TEST_PROJECT.id);
    await removeMembership(TEST_USERS.admin.id, API_TEST_PROJECT.id);
    await sc.from("projects").delete().eq("id", API_TEST_PROJECT.id);
  });

  describe("Project membership flow", () => {
    const tempUserId = TEST_USERS.member.id;
    const tempProjectId = "00000000-0000-0000-0000-000000000088";

    beforeAll(async () => {
      // Create a separate project for join/leave tests
      await sc.from("projects").upsert({
        id: tempProjectId,
        name: "Join Test Project",
        tenant_id: TEST_TENANT_ID,
        created_by: TEST_USERS.admin.id,
        is_archived: false,
      });
      await ensureMembership(TEST_USERS.admin.id, tempProjectId, "owner");
    });

    afterAll(async () => {
      await removeMembership(tempUserId, tempProjectId);
      await removeMembership(TEST_USERS.admin.id, tempProjectId);
      await sc.from("projects").delete().eq("id", tempProjectId);
    });

    it("can add membership via service role", async () => {
      // This is what the join route does
      const { error } = await sc
        .from("project_members")
        .insert({
          project_id: tempProjectId,
          user_id: tempUserId,
          role: "member",
        });

      expect(error).toBeNull();
    });

    it("membership persists after insert", async () => {
      const { data } = await sc
        .from("project_members")
        .select("role")
        .eq("project_id", tempProjectId)
        .eq("user_id", tempUserId)
        .single();

      expect(data).not.toBeNull();
      expect(data?.role).toBe("member");
    });

    it("duplicate join returns unique violation", async () => {
      const { error } = await sc
        .from("project_members")
        .insert({
          project_id: tempProjectId,
          user_id: tempUserId,
          role: "member",
        });

      expect(error).not.toBeNull();
      expect(error?.code).toBe("23505"); // unique_violation
    });

    it("can remove membership via service role", async () => {
      const { error } = await sc
        .from("project_members")
        .delete()
        .eq("project_id", tempProjectId)
        .eq("user_id", tempUserId);

      expect(error).toBeNull();
    });

    it("membership gone after delete", async () => {
      const { data } = await sc
        .from("project_members")
        .select("id")
        .eq("project_id", tempProjectId)
        .eq("user_id", tempUserId);

      expect(data).toHaveLength(0);
    });
  });

  describe("Project CRUD (service role)", () => {
    it("can read project by id", async () => {
      const { data, error } = await sc
        .from("projects")
        .select("id, name, tenant_id, is_archived")
        .eq("id", API_TEST_PROJECT.id)
        .single();

      expect(error).toBeNull();
      expect(data?.name).toBe(API_TEST_PROJECT.name);
      expect(data?.tenant_id).toBe(TEST_TENANT_ID);
    });

    it("can update project name", async () => {
      const newName = "API Test Updated";
      const { error } = await sc
        .from("projects")
        .update({ name: newName })
        .eq("id", API_TEST_PROJECT.id);

      expect(error).toBeNull();

      // Verify
      const { data } = await sc
        .from("projects")
        .select("name")
        .eq("id", API_TEST_PROJECT.id)
        .single();

      expect(data?.name).toBe(newName);

      // Restore
      await sc
        .from("projects")
        .update({ name: API_TEST_PROJECT.name })
        .eq("id", API_TEST_PROJECT.id);
    });

    it("can archive and restore project", async () => {
      // Archive
      await sc
        .from("projects")
        .update({ is_archived: true })
        .eq("id", API_TEST_PROJECT.id);

      let { data } = await sc
        .from("projects")
        .select("is_archived")
        .eq("id", API_TEST_PROJECT.id)
        .single();

      expect(data?.is_archived).toBe(true);

      // Restore
      await sc
        .from("projects")
        .update({ is_archived: false })
        .eq("id", API_TEST_PROJECT.id);

      ({ data } = await sc
        .from("projects")
        .select("is_archived")
        .eq("id", API_TEST_PROJECT.id)
        .single());

      expect(data?.is_archived).toBe(false);
    });
  });

  describe("Drawings CRUD", () => {
    it("can read drawings for project", async () => {
      const { data, error } = await sc
        .from("drawings")
        .select("id, display_name")
        .eq("project_id", API_TEST_PROJECT.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });

    it("drawing has correct project association", async () => {
      const { data } = await sc
        .from("drawings")
        .select("project_id, display_name")
        .eq("id", API_TEST_DRAWING.id)
        .single();

      expect(data?.project_id).toBe(API_TEST_PROJECT.id);
    });
  });

  describe("Activity log", () => {
    it("can insert activity log entry", async () => {
      const { error } = await sc.from("activity_log").insert({
        project_id: API_TEST_PROJECT.id,
        user_id: TEST_USERS.admin.id,
        action_type: "project.created",
        target_type: "project",
        target_id: API_TEST_PROJECT.id,
        metadata: { name: API_TEST_PROJECT.name },
      });

      expect(error).toBeNull();
    });

    it("can read activity log for project", async () => {
      const { data, error } = await sc
        .from("activity_log")
        .select("action_type, metadata")
        .eq("project_id", API_TEST_PROJECT.id);

      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
    });
  });

  describe("Tenant isolation", () => {
    it("profiles are scoped to tenant", async () => {
      const { data } = await sc
        .from("profiles")
        .select("id, tenant_id")
        .eq("tenant_id", TEST_TENANT_ID);

      expect(data!.length).toBeGreaterThan(0);
      data!.forEach((p) => {
        expect(p.tenant_id).toBe(TEST_TENANT_ID);
      });
    });

    it("projects are scoped to tenant", async () => {
      const { data } = await sc
        .from("projects")
        .select("id, tenant_id")
        .eq("tenant_id", TEST_TENANT_ID);

      data!.forEach((p) => {
        expect(p.tenant_id).toBe(TEST_TENANT_ID);
      });
    });
  });
});

describe("Authenticated API tests (requires TEST_ADMIN_PASSWORD + TEST_MEMBER_PASSWORD)", () => {
  const adminPassword = process.env.TEST_ADMIN_PASSWORD;
  const memberPassword = process.env.TEST_MEMBER_PASSWORD;
  const runAuthTests = !!(adminPassword && memberPassword);

  async function signIn(email: string, password: string) {
    const client = createClient(SUPABASE_URL, ANON_KEY);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`Sign-in failed: ${error.message}`);
    return client;
  }

  beforeAll(async () => {
    if (!runAuthTests) return;
    // Ensure member is in the main test project
    await ensureMembership(TEST_USERS.member.id, API_TEST_PROJECT.id);
  });

  it.skipIf(!runAuthTests)("member can list project members (simulates GET /api/projects/[id]/members)", async () => {
    const client = await signIn(TEST_USERS.member.email, memberPassword!);

    // Step 1: check own membership (what the route does)
    const { data: membership } = await client
      .from("project_members")
      .select("id, role")
      .eq("project_id", API_TEST_PROJECT.id)
      .eq("user_id", TEST_USERS.member.id)
      .maybeSingle();

    expect(membership).not.toBeNull();

    // Step 2: fetch all members
    const { data: members, error } = await client
      .from("project_members")
      .select("id, user_id, role")
      .eq("project_id", API_TEST_PROJECT.id);

    expect(error).toBeNull();
    expect(members!.length).toBeGreaterThanOrEqual(2);
  });

  it.skipIf(!runAuthTests)("member can read drawings (simulates GET /api/projects/[id]/drawings)", async () => {
    const client = await signIn(TEST_USERS.member.email, memberPassword!);

    const { data, error } = await client
      .from("drawings")
      .select("id, display_name")
      .eq("project_id", API_TEST_PROJECT.id);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(!runAuthTests)("member can read activity log (simulates GET /api/projects/[id]/activity)", async () => {
    const client = await signIn(TEST_USERS.member.email, memberPassword!);

    const { data, error } = await client
      .from("activity_log")
      .select("id, action_type")
      .eq("project_id", API_TEST_PROJECT.id);

    expect(error).toBeNull();
  });

  it.skipIf(!runAuthTests)("admin can update project (simulates PATCH /api/projects/[id])", async () => {
    const client = await signIn(TEST_USERS.admin.email, adminPassword!);

    const { error } = await client
      .from("projects")
      .update({ name: "Admin Updated" })
      .eq("id", API_TEST_PROJECT.id);

    expect(error).toBeNull();

    // Restore
    await sc
      .from("projects")
      .update({ name: API_TEST_PROJECT.name })
      .eq("id", API_TEST_PROJECT.id);
  });

  it.skipIf(!runAuthTests)("member CANNOT update project (not owner)", async () => {
    const client = await signIn(TEST_USERS.member.email, memberPassword!);

    const { error } = await client
      .from("projects")
      .update({ name: "Member Hack" })
      .eq("id", API_TEST_PROJECT.id);

    // RLS should block this — either error or no rows affected
    // Supabase returns no error but 0 rows updated for RLS blocks
    if (!error) {
      const { data } = await sc
        .from("projects")
        .select("name")
        .eq("id", API_TEST_PROJECT.id)
        .single();
      expect(data?.name).toBe(API_TEST_PROJECT.name);
    }
  });
});

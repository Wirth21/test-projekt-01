import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Service role client — bypasses all RLS */
export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

/** Anon client — subject to RLS (no auth) */
export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY);
}

/**
 * Sign in as a user and return an authenticated Supabase client.
 * Uses email/password auth against the real Supabase instance.
 */
export async function signInAs(
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = createClient(SUPABASE_URL, ANON_KEY);
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Failed to sign in as ${email}: ${error.message}`);
  return client;
}

/** Test users — these must exist in the database */
export const TEST_USERS = {
  admin: {
    email: "f.stoeckel@wirth-chemnitz.de",
    password: process.env.TEST_ADMIN_PASSWORD || "",
    id: "71b25f7e-3c5e-45c9-b78b-a0eed4987907",
  },
  member: {
    email: "f.neubert@wirth-chemnitz.de",
    password: process.env.TEST_MEMBER_PASSWORD || "",
    id: "71820b8f-c91a-469c-804c-5e4b7c367e83",
  },
};

export const TEST_PROJECT_ID = "f6515c6f-aa24-49e4-a153-68ea30ce5e59"; // test projekt 1
export const TEST_TENANT_ID = "ee7f6c96-b58e-469f-a987-68b488449cd3";

/**
 * Ensure a user is a member of a project (service role insert).
 * Useful for test setup.
 */
export async function ensureMembership(
  userId: string,
  projectId: string,
  role: "owner" | "member" = "member"
) {
  const sc = serviceClient();
  await sc
    .from("project_members")
    .upsert(
      { project_id: projectId, user_id: userId, role },
      { onConflict: "project_id,user_id" }
    );
}

/**
 * Remove a membership (service role).
 */
export async function removeMembership(userId: string, projectId: string) {
  const sc = serviceClient();
  await sc
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
}

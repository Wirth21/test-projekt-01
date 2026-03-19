import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// GET /api/profiles — list all team member profiles
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

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Profile konnten nicht geladen werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ profiles });
}

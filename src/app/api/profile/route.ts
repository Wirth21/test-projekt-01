import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { updateProfileSchema } from "@/lib/validations/profile";

// GET /api/profile — get the current user's profile
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

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, email, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Profil konnte nicht geladen werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile });
}

// PUT /api/profile — update the current user's profile
export async function PUT(request: Request) {
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

  // Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Ungültiger Request-Body" },
      { status: 400 }
    );
  }

  const result = updateProfileSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { display_name } = result.data;

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ display_name })
    .eq("id", user.id)
    .select("id, display_name, email, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Profil konnte nicht aktualisiert werden" },
      { status: 500 }
    );
  }

  return NextResponse.json({ profile });
}

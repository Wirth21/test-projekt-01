import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { editProjectSchema } from "@/lib/validations/project";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH /api/projects/[id] — update project name/description (owner only)
export async function PATCH(request: Request, { params }: RouteParams) {
  const { id } = await params;
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

  const result = editProjectSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: "Validierungsfehler", details: result.error.flatten() },
      { status: 400 }
    );
  }

  const { name, description } = result.data;

  const { data: project, error: updateError } = await supabase
    .from("projects")
    .update({ name, description: description || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Projekt konnte nicht aktualisiert werden" }, { status: 500 });
  }

  return NextResponse.json({ project });
}

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// POST /api/locale — update user's locale preference
export async function POST(request: Request) {
  const { locale } = await request.json();

  if (!["de", "en"].includes(locale)) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }

  const response = NextResponse.json({ success: true });
  // Set cookie for next-intl to read (works for both authenticated and unauthenticated users)
  response.cookies.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
  });

  // If authenticated, also persist to profile
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("profiles")
        .update({ locale })
        .eq("id", user.id);
    }
  } catch {
    // Cookie is set regardless — profile update is best-effort
  }

  return response;
}

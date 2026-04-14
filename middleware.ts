import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function buildUrl(request: NextRequest, pathname: string, searchParams?: Record<string, string>): URL {
  const host = request.headers.get("host") || "localhost:3000";
  const protocol = host.includes("localhost") ? "http" : "https";
  const url = new URL(pathname, `${protocol}://${host}`);
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ──────────────────────────────────────────────
  // 1. Superadmin routes
  // ──────────────────────────────────────────────
  if (pathname === "/superadmin/login") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/superadmin")) {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.redirect(buildUrl(request, "/superadmin/login"));
    }

    // Check superadmin status
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const { createClient } = await import("@supabase/supabase-js");
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceRoleKey
      );

      const { data: profile } = await serviceClient
        .from("profiles")
        .select("is_superadmin, status")
        .eq("id", user.id)
        .single();

      if (!profile?.is_superadmin || profile.status !== "active") {
        return NextResponse.redirect(buildUrl(request, "/superadmin/login"));
      }
    } else {
      return NextResponse.redirect(buildUrl(request, "/superadmin/login"));
    }

    return supabaseResponse;
  }

  // Superadmin API routes: refresh session cookies
  if (pathname.startsWith("/api/superadmin")) {
    let apiResponse = NextResponse.next({ request });
    const supabaseApi = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll(); },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            apiResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) => apiResponse.cookies.set(name, value, options));
          },
        },
      }
    );
    await supabaseApi.auth.getUser();
    return apiResponse;
  }

  // ──────────────────────────────────────────────
  // 2. Public routes (landing page, login, register, auth, legal, etc.)
  // ──────────────────────────────────────────────
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/datenschutz") ||
    pathname.startsWith("/impressum") ||
    pathname === "/sitemap.xml" ||
    pathname === "/icon.svg";

  const isApiRoute = pathname.startsWith("/api");

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // ──────────────────────────────────────────────
  // 3. Auth check for protected routes
  // ──────────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Auth service unreachable (offline) — let through for cached content
    return supabaseResponse;
  }

  // Unauthenticated user on a protected route → redirect to /login
  if (!user && !isApiRoute) {
    return NextResponse.redirect(buildUrl(request, "/login"));
  }

  // Authenticated user on login/register → redirect to /dashboard
  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(buildUrl(request, "/dashboard"));
  }

  // ──────────────────────────────────────────────
  // 4. Profile check + tenant context (from user profile, not subdomain)
  //    Applies to both page and API routes so getTenantContext() works everywhere
  // ──────────────────────────────────────────────
  if (user) {
    let profile: { status: string; is_admin: boolean; tenant_id: string } | null = null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("status, is_admin, tenant_id")
        .eq("id", user.id)
        .single();
      profile = data;
    } catch {
      // Profile lookup failed (network) — let through for offline
      return supabaseResponse;
    }

    if (profile) {
      // Set tenant context headers for API routes to use
      request.headers.set("x-tenant-id", profile.tenant_id);

      // Rebuild response with updated headers
      supabaseResponse = NextResponse.next({ request });

      // Page-only checks (redirects don't make sense for API routes)
      if (!isApiRoute) {
        // Pending users: block access
        if (profile.status === "pending") {
          await supabase.auth.signOut();
          return NextResponse.redirect(buildUrl(request, "/login", { error: "pending" }));
        }

        // Disabled/deleted users: block access
        if (profile.status === "disabled" || profile.status === "deleted") {
          await supabase.auth.signOut();
          return NextResponse.redirect(buildUrl(request, "/login", { error: "disabled" }));
        }

        // Admin route protection
        if (pathname.startsWith("/admin") && !profile.is_admin) {
          return NextResponse.redirect(buildUrl(request, "/dashboard"));
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

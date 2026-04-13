import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { extractSubdomain } from "@/lib/tenant";

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
  const hostname = request.headers.get("host") || "localhost:3000";
  const subdomain = extractSubdomain(hostname);
  const { pathname } = request.nextUrl;

  // ──────────────────────────────────────────────
  // 1. Root domain (no subdomain) → Landing Page + Superadmin
  // ──────────────────────────────────────────────
  if (!subdomain) {
    // Superadmin login page is public
    if (pathname === "/superadmin/login") {
      return NextResponse.next();
    }

    // Superadmin routes require is_superadmin = true
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

      // Check superadmin status — use service role to bypass RLS
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

    // Superadmin API routes: refresh session cookies (auth checked in route handlers)
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

    // All other root domain routes are public (landing page, etc.)
    return NextResponse.next();
  }

  // ──────────────────────────────────────────────
  // 2. Subdomain detected → Resolve tenant (direct REST call to avoid RLS issues)
  //    Offline-safe: if the fetch fails (e.g. no network), let the request through
  //    so the Service Worker / cached app can handle it.
  // ──────────────────────────────────────────────
  let tenant: { id: string; slug: string; is_active: boolean } | null = null;

  try {
    const tenantRes = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/tenants?slug=eq.${subdomain}&select=id,slug,is_active&limit=1`,
      {
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
        },
      }
    );
    const tenants = await tenantRes.json();
    tenant = Array.isArray(tenants) ? tenants[0] : null;
  } catch {
    // Network error (offline) — let the request through so the SW can serve cached content.
    // The client-side app will use IndexedDB data. Auth is still validated via cookies.
    return NextResponse.next({ request });
  }

  // Unknown or inactive tenant → redirect to landing page
  if (!tenant || !tenant.is_active) {
    const landingUrl = new URL("/", request.url);
    const rootHost = hostname.replace(`${subdomain}.`, "");
    landingUrl.host = rootHost;
    return NextResponse.redirect(landingUrl);
  }

  // Set tenant context on the request BEFORE creating supabase client
  request.headers.set("x-tenant-id", tenant.id);
  request.headers.set("x-tenant-slug", tenant.slug);

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

  // ──────────────────────────────────────────────
  // 3. Auth checks (existing logic, now tenant-scoped)
  //    Wrapped in try/catch: if Supabase is unreachable, let request through
  //    so cached content can be served.
  // ──────────────────────────────────────────────
  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Auth service unreachable — let through for offline/cached content
    return supabaseResponse;
  }

  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth");

  const isApiRoute = pathname.startsWith("/api");

  // Unauthenticated user on a protected route → redirect to /login
  if (!user && !isPublicRoute && !isApiRoute) {
    return NextResponse.redirect(buildUrl(request, "/login"));
  }

  // Authenticated user: check profile status + tenant membership
  if (user && !isPublicRoute && !isApiRoute) {
    let profile: { status: string; is_admin: boolean; tenant_id: string } | null = null;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("status, is_admin, tenant_id")
        .eq("id", user.id)
        .single();
      profile = data;
    } catch {
      // Profile lookup failed (network) — let through
      return supabaseResponse;
    }

    if (profile) {
      // User belongs to a different tenant → deny access
      if (profile.tenant_id !== tenant.id) {
        await supabase.auth.signOut();
        return NextResponse.redirect(buildUrl(request, "/login", { error: "wrong_tenant" }));
      }

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

      // Admin route protection: non-admins get redirected to dashboard
      if (pathname.startsWith("/admin") && !profile.is_admin) {
        return NextResponse.redirect(buildUrl(request, "/dashboard"));
      }
    }
  }

  // Authenticated user on login or register → redirect to /dashboard
  if (user && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(buildUrl(request, "/dashboard"));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

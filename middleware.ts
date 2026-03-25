import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { extractSubdomain } from "@/lib/tenant";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") || "localhost:3000";
  const subdomain = extractSubdomain(hostname);
  const { pathname } = request.nextUrl;

  // ──────────────────────────────────────────────
  // 1. Root domain (no subdomain) → Landing Page
  //    No auth checks needed for the public site
  // ──────────────────────────────────────────────
  if (!subdomain) {
    return NextResponse.next();
  }

  // ──────────────────────────────────────────────
  // 2. Subdomain detected → Resolve tenant
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

  // Lookup tenant by slug (using service role would bypass RLS,
  // but anon key works here since we just need to check existence)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("id, slug, is_active")
    .eq("slug", subdomain)
    .single();

  // Unknown or inactive tenant → redirect to landing page
  if (!tenant || !tenant.is_active) {
    const landingUrl = new URL("/", request.url);
    // Redirect to root domain
    const rootHost = hostname.replace(`${subdomain}.`, "");
    landingUrl.host = rootHost;
    return NextResponse.redirect(landingUrl);
  }

  // Set tenant context headers for downstream use
  supabaseResponse.headers.set("x-tenant-id", tenant.id);
  supabaseResponse.headers.set("x-tenant-slug", tenant.slug);

  // ──────────────────────────────────────────────
  // 3. Auth checks (existing logic, now tenant-scoped)
  // ──────────────────────────────────────────────
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth");

  const isApiRoute = pathname.startsWith("/api");

  // Unauthenticated user on a protected route → redirect to /login
  if (!user && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authenticated user: check profile status + tenant membership
  if (user && !isPublicRoute && !isApiRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, is_admin, tenant_id")
      .eq("id", user.id)
      .single();

    if (profile) {
      // User belongs to a different tenant → deny access
      if (profile.tenant_id !== tenant.id) {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "wrong_tenant");
        return NextResponse.redirect(url);
      }

      // Pending users: block access
      if (profile.status === "pending") {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "pending");
        return NextResponse.redirect(url);
      }

      // Disabled/deleted users: block access
      if (profile.status === "disabled" || profile.status === "deleted") {
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("error", "disabled");
        return NextResponse.redirect(url);
      }

      // Admin route protection: non-admins get redirected to dashboard
      if (pathname.startsWith("/admin") && !profile.is_admin) {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }
  }

  // Authenticated user on login or register → redirect to /dashboard
  if (user && (pathname === "/login" || pathname === "/register")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

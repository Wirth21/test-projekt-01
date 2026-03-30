import { NextResponse } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/superadmin";
import { getTenantContext } from "@/lib/tenant";
import { getStripe } from "@/lib/stripe";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

const checkoutSchema = z.object({
  plan: z.enum(["team", "business"]),
});

export async function POST(request: Request) {
  // Rate limit: 5 requests per minute
  const key = getRateLimitKey(request);
  const limiter = rateLimit(`billing-checkout:${key}`, 5, 60_000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte versuche es später erneut." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    // Authenticate user
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Validate request body
    const body = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { plan } = parsed.data;

    // Get tenant context
    const { tenantId, tenantSlug } = await getTenantContext();

    // Get price ID for the selected plan
    const priceId =
      plan === "team"
        ? process.env.STRIPE_TEAM_PRICE_ID
        : process.env.STRIPE_BUSINESS_PRICE_ID;

    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not configured for plan: ${plan}` },
        { status: 500 }
      );
    }

    const stripe = getStripe();
    const serviceClient = createServiceRoleClient();

    // Get tenant record
    const { data: tenant, error: tenantError } = await serviceClient
      .from("tenants")
      .select("id, stripe_customer_id, name")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Create Stripe customer if tenant doesn't have one yet
    let stripeCustomerId = tenant.stripe_customer_id;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: tenant.name,
        email: user.email,
        metadata: { tenant_id: tenantId },
      });
      stripeCustomerId = customer.id;

      // Save customer ID to tenant
      await serviceClient
        .from("tenants")
        .update({ stripe_customer_id: stripeCustomerId })
        .eq("id", tenantId);
    }

    // Build success/cancel URLs
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host =
      process.env.NODE_ENV === "production"
        ? `${tenantSlug}.link2plan.app`
        : `${tenantSlug}.localhost:3000`;
    const baseUrl = `${protocol}://${host}`;

    // Create Checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${baseUrl}/dashboard?checkout=success`,
      cancel_url: `${baseUrl}/dashboard`,
      subscription_data: {
        trial_period_days: 14,
        metadata: { tenant_id: tenantId },
      },
      metadata: { tenant_id: tenantId },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[billing/checkout] Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

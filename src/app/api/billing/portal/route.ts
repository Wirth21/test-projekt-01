import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createServiceRoleClient } from "@/lib/superadmin";
import { getTenantContext } from "@/lib/tenant";
import { getStripe } from "@/lib/stripe";

export async function POST() {
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

    // Get tenant context
    const { tenantId, tenantSlug } = await getTenantContext();

    const serviceClient = createServiceRoleClient();

    // Get tenant's Stripe customer ID
    const { data: tenant, error: tenantError } = await serviceClient
      .from("tenants")
      .select("stripe_customer_id")
      .eq("id", tenantId)
      .single();

    if (tenantError || !tenant?.stripe_customer_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 400 }
      );
    }

    const stripe = getStripe();

    // Build return URL
    const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
    const host =
      process.env.NODE_ENV === "production"
        ? `${tenantSlug}.link2plan.app`
        : `${tenantSlug}.localhost:3000`;
    const returnUrl = `${protocol}://${host}/dashboard`;

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: tenant.stripe_customer_id,
      return_url: returnUrl,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[billing/portal] Error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}

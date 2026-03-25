import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/superadmin";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

export const runtime = "nodejs";

/**
 * Maps a Stripe price ID to a plan name.
 */
function priceIdToPlan(priceId: string): "team" | "business" | null {
  if (priceId === process.env.STRIPE_TEAM_PRICE_ID) return "team";
  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return "business";
  return null;
}

export async function POST(request: Request) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const stripe = getStripe();
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/webhook] Signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  const serviceClient = createServiceRoleClient();

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const tenantId = session.metadata?.tenant_id;

        if (!tenantId || !session.subscription) break;

        // Fetch the subscription to get price and status details
        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceId ? priceIdToPlan(priceId) : null;

        await serviceClient
          .from("tenants")
          .update({
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            plan: plan ?? "team",
            subscription_status: subscription.status,
            current_period_end: new Date(
              subscription.items.data[0].current_period_end * 1000
            ).toISOString(),
          })
          .eq("id", tenantId);

        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenant_id;

        if (!tenantId) {
          // Try to find tenant by subscription ID
          const { data: tenant } = await serviceClient
            .from("tenants")
            .select("id")
            .eq("stripe_subscription_id", subscription.id)
            .single();

          if (!tenant) break;

          const priceId = subscription.items.data[0]?.price?.id;
          const plan = priceId ? priceIdToPlan(priceId) : null;

          await serviceClient
            .from("tenants")
            .update({
              ...(plan ? { plan } : {}),
              subscription_status: subscription.status,
              current_period_end: new Date(
                subscription.items.data[0].current_period_end * 1000
              ).toISOString(),
            })
            .eq("id", tenant.id);
        } else {
          const priceId = subscription.items.data[0]?.price?.id;
          const plan = priceId ? priceIdToPlan(priceId) : null;

          await serviceClient
            .from("tenants")
            .update({
              ...(plan ? { plan } : {}),
              subscription_status: subscription.status,
              current_period_end: new Date(
                subscription.items.data[0].current_period_end * 1000
              ).toISOString(),
            })
            .eq("id", tenantId);
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenant_id;

        // Find tenant by metadata or subscription ID
        let targetTenantId = tenantId;
        if (!targetTenantId) {
          const { data: tenant } = await serviceClient
            .from("tenants")
            .select("id")
            .eq("stripe_subscription_id", subscription.id)
            .single();

          if (tenant) targetTenantId = tenant.id;
        }

        if (targetTenantId) {
          await serviceClient
            .from("tenants")
            .update({
              plan: "free",
              subscription_status: "canceled",
              stripe_subscription_id: null,
              current_period_end: null,
            })
            .eq("id", targetTenantId);
        }

        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        if (customerId) {
          await serviceClient
            .from("tenants")
            .update({ subscription_status: "past_due" })
            .eq("stripe_customer_id", customerId);
        }

        break;
      }

      default:
        // Unhandled event type — ignore
        break;
    }
  } catch (error) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ received: true });
}

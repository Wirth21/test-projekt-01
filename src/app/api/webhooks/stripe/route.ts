import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/superadmin";
import { getStripe } from "@/lib/stripe";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import type Stripe from "stripe";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Idempotency: in-memory Set of processed event IDs with TTL cleanup
// ---------------------------------------------------------------------------
const PROCESSED_EVENTS = new Set<string>();
const EVENT_TIMESTAMPS = new Map<string, number>();
const EVENT_TTL_MS = 5 * 60 * 1000; // 5 minutes
const GRACE_PERIOD_DAYS = 7;

function cleanupOldEvents() {
  const now = Date.now();
  for (const [id, ts] of EVENT_TIMESTAMPS) {
    if (now - ts > EVENT_TTL_MS) {
      PROCESSED_EVENTS.delete(id);
      EVENT_TIMESTAMPS.delete(id);
    }
  }
}

function markEventProcessed(eventId: string) {
  PROCESSED_EVENTS.add(eventId);
  EVENT_TIMESTAMPS.set(eventId, Date.now());
}

/**
 * Maps a Stripe price ID to a plan name.
 */
function priceIdToPlan(priceId: string): "team" | "business" | null {
  if (priceId === process.env.STRIPE_TEAM_PRICE_ID) return "team";
  if (priceId === process.env.STRIPE_BUSINESS_PRICE_ID) return "business";
  return null;
}

/**
 * Resolves the tenant ID from subscription metadata or by looking up the
 * stripe_subscription_id in the tenants table.
 */
async function resolveTenantId(
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  subscription: Stripe.Subscription
): Promise<string | null> {
  const tenantId = subscription.metadata?.tenant_id;
  if (tenantId) return tenantId;

  const { data: tenant } = await serviceClient
    .from("tenants")
    .select("id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  return tenant?.id ?? null;
}

// ---------------------------------------------------------------------------
// Individual event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  serviceClient: ReturnType<typeof createServiceRoleClient>,
  stripe: Stripe
) {
  const session = event.data.object as Stripe.Checkout.Session;
  const tenantId = session.metadata?.tenant_id;

  if (!tenantId || !session.subscription) {
    console.warn(
      "[stripe/webhook] checkout.session.completed missing tenant_id or subscription"
    );
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    session.subscription as string
  );

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceId ? priceIdToPlan(priceId) : null;

  const { error } = await serviceClient
    .from("tenants")
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscription.id,
      plan: plan ?? "team",
      subscription_status: subscription.status,
      current_period_end: new Date(
        subscription.items.data[0].current_period_end * 1000
      ).toISOString(),
      past_due_since: null, // Clear any previous grace period
    })
    .eq("id", tenantId);

  if (error) {
    console.error(
      `[stripe/webhook] checkout.session.completed: failed to update tenant ${tenantId}:`,
      error.message
    );
  }
}

async function handleSubscriptionUpdated(
  event: Stripe.Event,
  serviceClient: ReturnType<typeof createServiceRoleClient>
) {
  const subscription = event.data.object as Stripe.Subscription;
  const tenantId = await resolveTenantId(serviceClient, subscription);

  if (!tenantId) {
    console.warn(
      "[stripe/webhook] customer.subscription.updated: could not resolve tenant for subscription",
      subscription.id
    );
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const plan = priceId ? priceIdToPlan(priceId) : null;

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    ...(plan ? { plan } : {}),
    subscription_status: subscription.status,
    current_period_end: new Date(
      subscription.items.data[0].current_period_end * 1000
    ).toISOString(),
  };

  // Grace period logic: track when past_due started
  if (subscription.status === "past_due") {
    // Only set past_due_since if not already set (first transition)
    const { data: tenant } = await serviceClient
      .from("tenants")
      .select("past_due_since")
      .eq("id", tenantId)
      .single();

    if (!tenant?.past_due_since) {
      updatePayload.past_due_since = new Date().toISOString();
      console.warn(
        `[stripe/webhook] Tenant ${tenantId} entered past_due — grace period started`
      );
    } else {
      // Check if grace period (7 days) has expired
      const pastDueSince = new Date(tenant.past_due_since).getTime();
      const daysSincePastDue =
        (Date.now() - pastDueSince) / (1000 * 60 * 60 * 24);

      if (daysSincePastDue >= GRACE_PERIOD_DAYS) {
        console.warn(
          `[stripe/webhook] Tenant ${tenantId} past_due for ${Math.floor(daysSincePastDue)} days — auto-downgrading to free`
        );
        updatePayload.plan = "free";
        updatePayload.stripe_subscription_id = null;
        updatePayload.subscription_status = null;
        updatePayload.past_due_since = null;
        updatePayload.current_period_end = null;
      }
    }
  } else if (subscription.status === "active") {
    // Payment recovered — clear grace period
    updatePayload.past_due_since = null;
  }

  const { error } = await serviceClient
    .from("tenants")
    .update(updatePayload)
    .eq("id", tenantId);

  if (error) {
    console.error(
      `[stripe/webhook] customer.subscription.updated: failed to update tenant ${tenantId}:`,
      error.message
    );
  }
}

async function handleSubscriptionDeleted(
  event: Stripe.Event,
  serviceClient: ReturnType<typeof createServiceRoleClient>
) {
  const subscription = event.data.object as Stripe.Subscription;
  const tenantId = await resolveTenantId(serviceClient, subscription);

  if (!tenantId) {
    console.warn(
      "[stripe/webhook] customer.subscription.deleted: could not resolve tenant for subscription",
      subscription.id
    );
    return;
  }

  // Downgrade to free: clear all subscription fields
  const { error } = await serviceClient
    .from("tenants")
    .update({
      plan: "free",
      subscription_status: null,
      stripe_subscription_id: null,
      current_period_end: null,
      past_due_since: null,
    })
    .eq("id", tenantId);

  if (error) {
    console.error(
      `[stripe/webhook] customer.subscription.deleted: failed to downgrade tenant ${tenantId}:`,
      error.message
    );
  } else {
    console.info(
      `[stripe/webhook] Tenant ${tenantId} downgraded to free after subscription deletion`
    );
  }
}

async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  serviceClient: ReturnType<typeof createServiceRoleClient>
) {
  const invoice = event.data.object as Stripe.Invoice;
  const customerId = invoice.customer as string;

  if (!customerId) {
    console.warn(
      "[stripe/webhook] invoice.payment_failed: missing customer ID"
    );
    return;
  }

  // Set status to past_due but do NOT downgrade — grace period applies
  const { data: tenant } = await serviceClient
    .from("tenants")
    .select("id, past_due_since")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!tenant) {
    console.warn(
      `[stripe/webhook] invoice.payment_failed: no tenant found for customer ${customerId}`
    );
    return;
  }

  const updatePayload: Record<string, unknown> = {
    subscription_status: "past_due",
  };

  // Only set past_due_since if not already tracking a grace period
  if (!tenant.past_due_since) {
    updatePayload.past_due_since = new Date().toISOString();
  }

  const { error } = await serviceClient
    .from("tenants")
    .update(updatePayload)
    .eq("id", tenant.id);

  if (error) {
    console.error(
      `[stripe/webhook] invoice.payment_failed: failed to update tenant ${tenant.id}:`,
      error.message
    );
  } else {
    console.warn(
      `[stripe/webhook] Payment failed for tenant ${tenant.id} — status set to past_due (grace period active)`
    );
  }
}

// ---------------------------------------------------------------------------
// Main webhook handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Rate limit: 100 requests per minute
  const key = getRateLimitKey(request);
  const limiter = rateLimit(`stripe-webhook:${key}`, 100, 60_000);
  if (!limiter.success) {
    return NextResponse.json(
      { error: "Zu viele Anfragen. Bitte versuche es später erneut." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

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

  // Idempotency check: skip already-processed events
  cleanupOldEvents();
  if (PROCESSED_EVENTS.has(event.id)) {
    console.info(
      `[stripe/webhook] Skipping already-processed event ${event.id} (${event.type})`
    );
    return NextResponse.json({ received: true });
  }

  const serviceClient = createServiceRoleClient();

  // Always return 200 to Stripe to prevent unnecessary retries.
  // Each handler has its own try/catch for granular error logging.
  switch (event.type) {
    case "checkout.session.completed":
      try {
        await handleCheckoutSessionCompleted(event, serviceClient, stripe);
      } catch (error) {
        console.error(
          `[stripe/webhook] Unhandled error in checkout.session.completed (event ${event.id}):`,
          error
        );
      }
      break;

    case "customer.subscription.updated":
      try {
        await handleSubscriptionUpdated(event, serviceClient);
      } catch (error) {
        console.error(
          `[stripe/webhook] Unhandled error in customer.subscription.updated (event ${event.id}):`,
          error
        );
      }
      break;

    case "customer.subscription.deleted":
      try {
        await handleSubscriptionDeleted(event, serviceClient);
      } catch (error) {
        console.error(
          `[stripe/webhook] Unhandled error in customer.subscription.deleted (event ${event.id}):`,
          error
        );
      }
      break;

    case "invoice.payment_failed":
      try {
        await handleInvoicePaymentFailed(event, serviceClient);
      } catch (error) {
        console.error(
          `[stripe/webhook] Unhandled error in invoice.payment_failed (event ${event.id}):`,
          error
        );
      }
      break;

    default:
      // Unhandled event type — ignore
      break;
  }

  // Mark as processed after handling (even on error, to avoid retry loops)
  markEventProcessed(event.id);

  return NextResponse.json({ received: true });
}

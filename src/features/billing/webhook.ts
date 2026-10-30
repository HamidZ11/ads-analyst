import type {
  BillingEventType,
  BillingInterval,
  BillingOutcome,
  BillingWriter,
  SubscriptionState,
} from "@/data/supabase/billing";
import { isSubscriptionStatus } from "./status";
import {
  isInterval,
  verifyStripeEvent,
  type BillingStripe,
  type StripeSubscriptionLike,
} from "./stripe";

/**
 * The Stripe webhook (D-083), free of Next.js so it can be tested with a
 * fake Stripe client and a fake writer:
 *
 * 1. Verify the signature over the raw body; anything unsigned is refused.
 * 2. Ignore event types billing doesn't use, without touching the database.
 * 3. Fetch the subscription from Stripe, so the stored state is Stripe's
 *    current one whatever order events arrive in.
 * 4. Hand it to the database in one call that also records the event id,
 *    so a redelivered event changes nothing.
 *
 * Failures after verification answer 500, and Stripe retries.
 */

export const HANDLED_EVENTS: readonly BillingEventType[] = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export interface WebhookInput {
  rawBody: string;
  signature: string | null;
  signingSecret: string;
  /** Whether the secret key is live; events from the other mode are refused. */
  live: boolean;
  prices: Partial<Record<BillingInterval, string>>;
  stripe: BillingStripe;
  writer: BillingWriter;
}

export interface WebhookResult {
  status: number;
  body: { received: boolean; outcome?: BillingOutcome | "ignored"; message?: string };
}

const workspaceFrom = (metadata: Record<string, string> | null | undefined): string | null => {
  const value = metadata?.workspace_id;
  return typeof value === "string" && UUID.test(value) ? value : null;
};

const idOf = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string")
    return (value as { id: string }).id;
  return null;
};

/**
 * Stripe's subscription as the row the database stores. The plan is
 * `agency` only for a configured Agency price; anything else (an Enterprise
 * subscription made by hand in Stripe) is `custom`. Throws on a status the
 * schema doesn't know, so the event is retried rather than misread.
 */
export function subscriptionState(
  subscription: StripeSubscriptionLike,
  prices: Partial<Record<BillingInterval, string>>,
  workspaceId: string | null,
): SubscriptionState {
  if (!isSubscriptionStatus(subscription.status))
    throw new Error(`unknown subscription status: ${subscription.status}`);
  const customer = idOf(subscription.customer);
  if (!customer) throw new Error("subscription without a customer");
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const interval = item?.price.recurring?.interval;
  const periodEnd = item?.current_period_end ?? null;
  return {
    workspace_id: workspaceId ?? workspaceFrom(subscription.metadata),
    customer_id: customer,
    subscription_id: subscription.id,
    plan: priceId !== null && Object.values(prices).includes(priceId) ? "agency" : "custom",
    interval: isInterval(interval) ? interval : null,
    status: subscription.status,
    current_period_end: periodEnd === null ? null : new Date(periodEnd * 1000).toISOString(),
    // Stripe's portal may schedule a cancellation with `cancel_at` instead.
    cancel_at_period_end: subscription.cancel_at_period_end || subscription.cancel_at !== null,
  };
}

export async function handleStripeWebhook(input: WebhookInput): Promise<WebhookResult> {
  if (!input.signature)
    return { status: 400, body: { received: false, message: "Missing Stripe signature." } };

  let event: ReturnType<typeof verifyStripeEvent>;
  try {
    event = verifyStripeEvent(input.rawBody, input.signature, input.signingSecret);
  } catch {
    return { status: 400, body: { received: false, message: "Invalid Stripe signature." } };
  }
  if (event.livemode !== input.live)
    return {
      status: 400,
      body: { received: false, message: "Event mode doesn't match this deployment's key." },
    };

  const type = event.type as BillingEventType;
  if (!HANDLED_EVENTS.includes(type))
    return { status: 200, body: { received: true, outcome: "ignored" } };

  // Which subscription the event is about, and the workspace our own
  // Checkout put in its metadata, when there is one.
  const object = event.data.object as unknown as Record<string, unknown>;
  let subscriptionId: string | null = null;
  let workspaceId: string | null = null;
  if (type === "checkout.session.completed") {
    if (object.mode === "subscription") {
      subscriptionId = idOf(object.subscription);
      workspaceId = workspaceFrom(object.metadata as Record<string, string> | null);
    }
  } else if (type === "invoice.payment_failed") {
    const parent = object.parent as
      { subscription_details?: { subscription?: unknown } | null } | null | undefined;
    subscriptionId = idOf(parent?.subscription_details?.subscription);
  } else {
    subscriptionId = idOf(object.id);
  }

  try {
    const state = subscriptionId
      ? subscriptionState(
          await input.stripe.retrieveSubscription(subscriptionId),
          input.prices,
          workspaceId,
        )
      : null;
    const outcome = await input.writer.applyEvent(event.id, type, state);
    if (outcome === "unlinked" || outcome === "conflict" || outcome === "stale")
      console.warn(`[ad-analyst] billing event ${event.id} (${type}): ${outcome}`);
    return { status: 200, body: { received: true, outcome } };
  } catch (failure) {
    console.error(
      `[ad-analyst] billing event ${event.id} (${type}) failed:`,
      (failure as Error).message,
    );
    return {
      status: 500,
      body: { received: false, message: "The event couldn't be processed; Stripe will retry." },
    };
  }
}

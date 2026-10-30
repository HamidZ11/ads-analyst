import { createClient } from "@supabase/supabase-js";
import { GatewayError, gatewayError } from "./gateway";

/**
 * Subscription state in Postgres (D-083). Members read it through RLS with
 * their own session (`WorkspaceGateway.subscription`); only the Stripe
 * webhook writes it, through `apply_billing_event` and the webhook's
 * database secret. There is still no service-role key.
 */

export const SUBSCRIPTION_STATUSES = [
  "incomplete",
  "incomplete_expired",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "unpaid",
  "paused",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export type SubscriptionPlan = "agency" | "custom";
export type BillingInterval = "month" | "year";

/** A workspace's subscription as members read it. */
export interface WorkspaceSubscription {
  plan: SubscriptionPlan;
  interval: BillingInterval | null;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  /** Present once Checkout has created a Stripe customer; the portal needs it. */
  stripeCustomerId: string;
}

/** What the webhook asks the database to store, already fetched from Stripe. */
export interface SubscriptionState {
  /** From our own Checkout metadata; null lets the database match by subscription or customer. */
  workspace_id: string | null;
  customer_id: string;
  subscription_id: string;
  plan: SubscriptionPlan;
  interval: BillingInterval | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export type BillingEventType =
  | "checkout.session.completed"
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.payment_failed";

export type BillingOutcome =
  "duplicate" | "ignored" | "applied" | "unlinked" | "stale" | "conflict";

/** The webhook's only way into the database. */
export interface BillingWriter {
  applyEvent(
    eventId: string,
    type: BillingEventType,
    state: SubscriptionState | null,
  ): Promise<BillingOutcome>;
}

const OUTCOMES = new Set<BillingOutcome>([
  "duplicate",
  "ignored",
  "applied",
  "unlinked",
  "stale",
  "conflict",
]);

export function billingOutcome(value: unknown): BillingOutcome {
  if (typeof value === "string" && OUTCOMES.has(value as BillingOutcome))
    return value as BillingOutcome;
  throw new GatewayError("unavailable", "unexpected billing outcome");
}

export interface SubscriptionRow {
  plan: SubscriptionPlan;
  interval: BillingInterval | null;
  status: SubscriptionStatus;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  stripe_customer_id: string;
}

export const SUBSCRIPTION_COLUMNS =
  "plan, interval, status, current_period_end, cancel_at_period_end, stripe_customer_id";

export function subscriptionFromRow(row: SubscriptionRow | null): WorkspaceSubscription | null {
  if (!row) return null;
  return {
    plan: row.plan,
    interval: row.interval,
    status: row.status,
    currentPeriodEnd: row.current_period_end
      ? new Date(row.current_period_end).toISOString()
      : null,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    stripeCustomerId: row.stripe_customer_id,
  };
}

/**
 * The webhook's writer: the publishable key with no session (the `anon`
 * role), plus the secret that `apply_billing_event` checks. Server-only.
 */
export function supabaseBillingWriter(
  url: string,
  publishableKey: string,
  dbSecret: string,
): BillingWriter {
  const db = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    applyEvent: async (eventId, type, state) => {
      const { data, error } = await db.rpc("apply_billing_event", {
        p_secret: dbSecret,
        p_event_id: eventId,
        p_event_type: type,
        p_state: state,
      });
      if (error) throw gatewayError(error);
      return billingOutcome(data);
    },
  };
}

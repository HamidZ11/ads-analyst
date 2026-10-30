import Stripe from "stripe";
import type { BillingInterval } from "@/data/supabase/billing";

/**
 * The few Stripe calls billing makes, behind an interface so tests use a
 * fake and never reach Stripe. Shapes are the subset of Stripe's objects the
 * app reads.
 */

export interface StripeSubscriptionLike {
  id: string;
  customer: string | { id: string };
  status: string;
  metadata: Record<string, string> | null;
  cancel_at_period_end: boolean;
  cancel_at: number | null;
  items: {
    data: Array<{
      current_period_end: number | null;
      price: { id: string; recurring: { interval: string } | null };
    }>;
  };
}

export interface CheckoutSessionParams {
  priceId: string;
  workspaceId: string;
  customerId: string | null;
  customerEmail: string | null;
  successUrl: string;
  cancelUrl: string;
  /** Stripe replays the first session for a repeated key instead of making another. */
  idempotencyKey: string;
}

export interface BillingStripe {
  createCheckoutSession(params: CheckoutSessionParams): Promise<{ url: string | null }>;
  createPortalSession(params: {
    customerId: string;
    returnUrl: string;
  }): Promise<{ url: string }>;
  retrieveSubscription(id: string): Promise<StripeSubscriptionLike>;
  /**
   * Stripe's statuses for the subscriptions it holds for this workspace: the
   * customer's, and any carrying the workspace in our metadata (found before
   * the webhook has linked them).
   */
  subscriptionStatuses(params: {
    workspaceId: string;
    customerId: string | null;
  }): Promise<string[]>;
}

/** Workspace ids are UUIDs; anything else must never reach a search query. */
const SEARCHABLE_ID = /^[0-9a-zA-Z_-]+$/;

/** The real client. Only ever constructed with a key `stripeSecretKey` allowed. */
export function stripeClient(secretKey: string): BillingStripe {
  const stripe = new Stripe(secretKey, { maxNetworkRetries: 2, timeout: 20_000 });
  return {
    async createCheckoutSession(p) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          line_items: [{ price: p.priceId, quantity: 1 }],
          // The workspace travels in our own metadata, which only this server
          // sets; the webhook links the subscription from it (D-088).
          client_reference_id: p.workspaceId,
          metadata: { workspace_id: p.workspaceId },
          subscription_data: { metadata: { workspace_id: p.workspaceId } },
          ...(p.customerId
            ? { customer: p.customerId }
            : p.customerEmail
              ? { customer_email: p.customerEmail }
              : {}),
          success_url: p.successUrl,
          cancel_url: p.cancelUrl,
        },
        { idempotencyKey: p.idempotencyKey },
      );
      return { url: session.url };
    },
    async createPortalSession(p) {
      const session = await stripe.billingPortal.sessions.create({
        customer: p.customerId,
        return_url: p.returnUrl,
      });
      return { url: session.url };
    },
    async retrieveSubscription(id) {
      return (await stripe.subscriptions.retrieve(id)) as unknown as StripeSubscriptionLike;
    },
    async subscriptionStatuses(p) {
      if (!SEARCHABLE_ID.test(p.workspaceId)) throw new Error("Unexpected workspace id.");
      const statuses = new Map<string, string>();
      if (p.customerId) {
        const listed = await stripe.subscriptions.list({
          customer: p.customerId,
          status: "all",
          limit: 20,
        });
        for (const s of listed.data) statuses.set(s.id, s.status);
      }
      const found = await stripe.subscriptions.search({
        query: `metadata['workspace_id']:'${p.workspaceId}'`,
        limit: 20,
      });
      for (const s of found.data) statuses.set(s.id, s.status);
      return [...statuses.values()];
    },
  };
}

/**
 * Verifies Stripe's signature over the exact raw body and returns the event.
 * Throws on a missing, forged, or stale (over five minutes) signature.
 */
export function verifyStripeEvent(rawBody: string, signature: string, signingSecret: string) {
  return Stripe.webhooks.constructEvent(rawBody, signature, signingSecret);
}

export type StripeEvent = ReturnType<typeof verifyStripeEvent>;

export const isInterval = (value: unknown): value is BillingInterval =>
  value === "month" || value === "year";

import type { BillingInterval, WorkspaceSubscription } from "@/data/supabase/billing";
import type { CheckoutConfig } from "./config";
import { isLive, isSubscriptionStatus } from "./status";
import type { BillingStripe } from "./stripe";

/**
 * Starting Checkout and the customer portal for the signed-in workspace,
 * free of Next.js. Each returns where to send the browser: Stripe's page, or
 * back to Settings with a `billing` notice.
 */

export const SETTINGS_BILLING = "/settings";

export type BillingNotice =
  "success" | "cancelled" | "active" | "unavailable" | "owner" | "error";

export const settingsUrl = (origin: string, notice: BillingNotice) =>
  `${origin}${SETTINGS_BILLING}?billing=${notice}#billing`;

/** Repeated Subscribe clicks within this window reuse one Checkout session. */
export const CHECKOUT_WINDOW_MS = 10 * 60 * 1000;

/** One key per workspace, price and ten-minute window (Stripe keeps keys for 24 hours). */
export const checkoutIdempotencyKey = (workspaceId: string, priceId: string, now: Date) =>
  `checkout:${workspaceId}:${priceId}:${Math.floor(now.getTime() / CHECKOUT_WINDOW_MS)}`;

export async function checkoutRedirect(input: {
  config: CheckoutConfig | null;
  stripe: (secretKey: string) => BillingStripe;
  interval: BillingInterval;
  workspaceId: string;
  email: string | null;
  subscription: WorkspaceSubscription | null;
  now?: Date;
}): Promise<string> {
  const { config } = input;
  const price = config?.prices[input.interval];
  if (!config || !price) return settingsUrl(config?.origin ?? "", "unavailable");
  // One subscription per workspace: a live one is changed in the portal.
  if (input.subscription && isLive(input.subscription.status))
    return settingsUrl(config.origin, "active");
  try {
    const stripe = input.stripe(config.secretKey);
    const customerId = input.subscription?.stripeCustomerId ?? null;
    // The stored row lags the payment until the webhook lands, so ask Stripe
    // too: a second tab or click must not start a second subscription.
    const statuses = await stripe.subscriptionStatuses({
      workspaceId: input.workspaceId,
      customerId,
    });
    if (statuses.some((status) => isSubscriptionStatus(status) && isLive(status)))
      return settingsUrl(config.origin, "active");
    const session = await stripe.createCheckoutSession({
      priceId: price,
      workspaceId: input.workspaceId,
      // Reuse the workspace's Stripe customer after a cancellation.
      customerId,
      customerEmail: input.email,
      successUrl: settingsUrl(config.origin, "success"),
      cancelUrl: settingsUrl(config.origin, "cancelled"),
      idempotencyKey: checkoutIdempotencyKey(input.workspaceId, price, input.now ?? new Date()),
    });
    return session.url ?? settingsUrl(config.origin, "error");
  } catch (failure) {
    console.error("[ad-analyst] checkout could not start:", (failure as Error).message);
    return settingsUrl(config.origin, "error");
  }
}

export async function portalRedirect(input: {
  config: CheckoutConfig | null;
  stripe: (secretKey: string) => BillingStripe;
  subscription: WorkspaceSubscription | null;
}): Promise<string> {
  const { config, subscription } = input;
  if (!config || !subscription) return settingsUrl(config?.origin ?? "", "unavailable");
  try {
    const session = await input.stripe(config.secretKey).createPortalSession({
      customerId: subscription.stripeCustomerId,
      returnUrl: `${config.origin}${SETTINGS_BILLING}#billing`,
    });
    return session.url;
  } catch (failure) {
    console.error("[ad-analyst] billing portal could not open:", (failure as Error).message);
    return settingsUrl(config.origin, "error");
  }
}

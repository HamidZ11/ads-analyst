import { BILLING_RETURN_PATH, signInHref } from "@/features/auth/return-path";

/**
 * Where the pricing page's Agency "Subscribe" goes (D-088, amending D-065):
 *
 * - Checkout configured: Settings' Billing section in the app, where the
 *   signed-in workspace starts Checkout. The link goes through sign-in with
 *   `next`, so a signed-out visitor returns to Billing after signing in and
 *   a signed-in one passes straight through (D-NEW-billing-answers-1). The
 *   payment link is then never shown.
 * - Otherwise a valid payment link (D-062, D-065): Stripe's hosted page, the
 *   fallback for deployments without Checkout.
 * - Otherwise nothing, and the panel keeps Try the demo and Sign in.
 */
export type SubscribeTarget =
  { kind: "checkout"; href: string } | { kind: "payment_link"; href: string } | null;

export function agencySubscribeTarget(input: {
  checkoutConfigured: boolean;
  paymentLink: string | null;
}): SubscribeTarget {
  if (input.checkoutConfigured)
    return { kind: "checkout", href: signInHref(BILLING_RETURN_PATH) };
  if (input.paymentLink) return { kind: "payment_link", href: input.paymentLink };
  return null;
}

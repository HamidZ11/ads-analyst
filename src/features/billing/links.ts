/**
 * Where the pricing page's Agency "Subscribe" goes (D-083, amending D-065):
 *
 * - Checkout configured: Settings' Billing section in the app, where the
 *   signed-in workspace starts Checkout (signed-out visitors sign in first).
 * - Otherwise a valid payment link (D-062, D-065): Stripe's hosted page.
 * - Otherwise nothing, and the panel keeps Try the demo and Sign in.
 */
export type SubscribeTarget =
  | { kind: "checkout"; href: "/settings#billing" }
  | { kind: "payment_link"; href: string }
  | null;

export function agencySubscribeTarget(input: {
  checkoutConfigured: boolean;
  paymentLink: string | null;
}): SubscribeTarget {
  if (input.checkoutConfigured) return { kind: "checkout", href: "/settings#billing" };
  if (input.paymentLink) return { kind: "payment_link", href: input.paymentLink };
  return null;
}

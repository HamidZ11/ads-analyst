import type { WorkspaceSubscription } from "@/data/supabase/billing";
import { isEntitled } from "./status";

/**
 * The one billing policy (D-083): may this workspace import?
 *
 * - Enforcement off (the default, BILLING_ENFORCE unset): always yes.
 * - Enforcement requested but Checkout not configured: yes, because a
 *   blocked workspace would have no way to subscribe.
 * - Otherwise: only with an `active` or `trialing` subscription, or for
 *   `GRACE_DAYS` after a payment first failed while the subscription is
 *   `past_due` or `unpaid` (D-NEW-billing-answers-1). When the subscription
 *   can't be read, no (fail closed).
 *
 * Reading is never gated: every page stays available whatever this says.
 */

export type BillingRead = WorkspaceSubscription | null | "unavailable";

export interface ImportPolicyInput {
  enforce: boolean;
  checkoutConfigured: boolean;
  subscription: BillingRead;
  now: Date;
}

/** Days imports stay open after invoice.payment_failed, before gating stops them. */
export const GRACE_DAYS = 7;
const DAY_MS = 86_400_000;

export type ImportDecision =
  | { allowed: true; reason: "not_enforced" | "subscribed" }
  | { allowed: true; reason: "grace"; graceEndsAt: string }
  | { allowed: false; reason: "no_subscription" | "inactive" | "unknown" };

/** When a failed payment's grace period ends, for a subscription in one; else null. */
export function graceEndsAt(subscription: WorkspaceSubscription): Date | null {
  if (subscription.status !== "past_due" && subscription.status !== "unpaid") return null;
  if (!subscription.paymentFailedAt) return null;
  const failed = Date.parse(subscription.paymentFailedAt);
  return Number.isFinite(failed) ? new Date(failed + GRACE_DAYS * DAY_MS) : null;
}

export function importDecision({
  enforce,
  checkoutConfigured,
  subscription,
  now,
}: ImportPolicyInput): ImportDecision {
  if (!enforce || !checkoutConfigured) return { allowed: true, reason: "not_enforced" };
  if (subscription === "unavailable") return { allowed: false, reason: "unknown" };
  if (subscription === null) return { allowed: false, reason: "no_subscription" };
  if (isEntitled(subscription.status)) return { allowed: true, reason: "subscribed" };
  const ends = graceEndsAt(subscription);
  if (ends && now.getTime() < ends.getTime())
    return { allowed: true, reason: "grace", graceEndsAt: ends.toISOString() };
  return { allowed: false, reason: "inactive" };
}

/** What a blocked importer is told; reads stay available, so it says so. */
export const IMPORT_BLOCKED_MESSAGES: Record<
  Extract<ImportDecision, { allowed: false }>["reason"],
  string
> = {
  no_subscription:
    "Imports need an active subscription. Subscribe in Settings; everything already imported stays readable.",
  inactive:
    "Imports are paused until the subscription is active again. Check billing in Settings; everything already imported stays readable.",
  unknown:
    "The subscription couldn't be checked, so nothing was imported. Try again in a moment.",
};

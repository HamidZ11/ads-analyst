import type {
  BillingInterval,
  SubscriptionPlan,
  SubscriptionStatus,
  WorkspaceSubscription,
} from "@/data/supabase/billing";
import { SUBSCRIPTION_STATUSES } from "@/data/supabase/billing";

/** Statuses that pay for the product: the only ones that keep imports open under enforcement. */
export function isEntitled(status: SubscriptionStatus): boolean {
  return status === "active" || status === "trialing";
}

/**
 * A subscription that still exists in Stripe and can be managed (paid, due,
 * or paused). Ended ones (`canceled`, `incomplete_expired`) need a new
 * Checkout instead.
 */
export function isLive(status: SubscriptionStatus): boolean {
  return status !== "canceled" && status !== "incomplete_expired";
}

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly unknown[]).includes(value);
}

/** Settings' wording for each Stripe status. */
export const STATUS_LABELS: Record<SubscriptionStatus, string> = {
  active: "Active",
  trialing: "Trialing",
  past_due: "Payment overdue",
  unpaid: "Unpaid",
  paused: "Paused",
  incomplete: "Awaiting first payment",
  incomplete_expired: "Expired",
  canceled: "Cancelled",
};

export function planLabel(plan: SubscriptionPlan, interval: BillingInterval | null): string {
  const name = plan === "agency" ? "Agency" : "Custom";
  if (interval === "month") return `${name} · monthly`;
  if (interval === "year") return `${name} · yearly`;
  return name;
}

/** "Renews 12 Nov 2026", "Ends 12 Nov 2026", or null when there is nothing to say. */
export function periodLine(subscription: WorkspaceSubscription): string | null {
  if (!subscription.currentPeriodEnd || !isLive(subscription.status)) return null;
  const date = new Date(subscription.currentPeriodEnd).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  if (subscription.cancelAtPeriodEnd) return `Ends ${date}`;
  if (isEntitled(subscription.status)) return `Renews ${date}`;
  return null;
}

/** One line of guidance for statuses that need the customer to act. */
export function statusGuidance(status: SubscriptionStatus): string | null {
  switch (status) {
    case "past_due":
    case "unpaid":
      return "The last payment failed. Update the card in Manage billing.";
    case "incomplete":
      return "Stripe is waiting for the first payment to complete.";
    case "paused":
      return "Resume the subscription in Manage billing.";
    default:
      return null;
  }
}

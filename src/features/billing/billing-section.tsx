import { buttonClasses } from "@/components/ui/button";
import { DefinitionList } from "@/components/ui/definition-list";
import type { BillingInterval } from "@/data/supabase/billing";
import { SettingsSection } from "@/features/settings/client-settings";
import type { BillingNotice } from "./checkout";
import type { BillingRead, ImportDecision } from "./policy";
import { isLive, periodLine, planLabel, STATUS_LABELS, statusGuidance } from "./status";

/* Billing in Settings (D-083): the workspace's plan and status, and only
   the actions that work here. Subscribe needs Checkout configured; Manage
   billing also needs a Stripe customer. Nothing renders as a dead control
   (D-062). Amounts are left to Stripe's own page, which shows the price
   actually configured. */

export const NOTICES: Record<BillingNotice, string> = {
  success: "Thanks. The subscription appears here as soon as Stripe confirms it.",
  cancelled: "Checkout was cancelled. Nothing was charged.",
  active: "This workspace already has a subscription. Change it in Manage billing.",
  unavailable: "Billing isn't available right now. Nothing was charged.",
  error: "Stripe couldn't be reached. Nothing was charged; try again.",
};

export function parseNotice(value: unknown): BillingNotice | null {
  return typeof value === "string" && value in NOTICES ? (value as BillingNotice) : null;
}

export function BillingSection({
  subscription,
  intervals,
  portalConfigured,
  imports,
  notice,
}: {
  subscription: BillingRead;
  /** Intervals with a configured price; empty when Checkout isn't configured. */
  intervals: BillingInterval[];
  /** Checkout configuration exists, so the portal can be opened for a customer. */
  portalConfigured: boolean;
  imports: ImportDecision;
  notice: BillingNotice | null;
}) {
  const known = subscription !== "unavailable" ? subscription : null;
  const live = known !== null && isLive(known.status);
  const canSubscribe = subscription !== "unavailable" && !live && intervals.length > 0;
  const canManage = portalConfigured && known !== null;

  const items =
    subscription === "unavailable"
      ? [
          {
            label: "Plan",
            value: "Couldn't be loaded",
            detail: "Reload the page to try again.",
          },
        ]
      : known === null
        ? [{ label: "Plan", value: "No subscription" }]
        : [
            { label: "Plan", value: planLabel(known.plan, known.interval) },
            {
              label: "Status",
              value: STATUS_LABELS[known.status],
              detail: statusGuidance(known.status) ?? periodLine(known) ?? undefined,
            },
          ];

  return (
    <SettingsSection
      id="billing"
      title="Billing"
      description={
        intervals.length > 0
          ? "Billed by Stripe. Card details go to Stripe, never to Ad Analyst."
          : "Billing isn’t connected in this deployment yet."
      }
    >
      {notice ? (
        <p role="status" className="mb-2 text-sm leading-5 text-ink-secondary">
          {NOTICES[notice]}
        </p>
      ) : null}
      <DefinitionList items={items} />
      {!imports.allowed && imports.reason !== "unknown" ? (
        <p className="mt-3 text-sm leading-5 text-ink-secondary">
          Imports are paused until this workspace has an active subscription. Everything already
          imported stays readable.
        </p>
      ) : null}
      {canSubscribe || canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {canSubscribe ? (
            <form action="/api/billing/checkout" method="post" className="flex flex-wrap gap-2">
              {intervals.map((interval, index) => (
                <button
                  key={interval}
                  type="submit"
                  name="interval"
                  value={interval}
                  className={buttonClasses(index === 0 ? "primary" : "secondary")}
                >
                  {interval === "month" ? "Subscribe monthly" : "Subscribe yearly"}
                </button>
              ))}
            </form>
          ) : null}
          {canManage ? (
            <form action="/api/billing/portal" method="post">
              <button type="submit" className={buttonClasses("secondary")}>
                Manage billing
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </SettingsSection>
  );
}

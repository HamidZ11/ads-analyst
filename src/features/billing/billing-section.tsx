import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { DefinitionList } from "@/components/ui/definition-list";
import type { BillingInterval } from "@/data/supabase/billing";
import { SettingsSection } from "@/features/settings/client-settings";
import type { BillingNotice } from "./checkout";
import type { BillingRead, ImportDecision } from "./policy";
import { isLive, periodLine, planLabel, STATUS_LABELS, statusGuidance } from "./status";

/* Billing in Settings (D-088): the workspace's plan and status, and only
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

/** Client accounts the Agency plan includes (D-055); a soft notice, never enforced. */
export const AGENCY_CLIENT_LIMIT = 10;

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

export function parseNotice(value: unknown): BillingNotice | null {
  return typeof value === "string" && value in NOTICES ? (value as BillingNotice) : null;
}

export function BillingSection({
  subscription,
  intervals,
  portalConfigured,
  imports,
  notice,
  clientCount,
}: {
  subscription: BillingRead;
  /** Intervals with a configured price; empty when Checkout isn't configured. */
  intervals: BillingInterval[];
  /** Checkout configuration exists, so the portal can be opened for a customer. */
  portalConfigured: boolean;
  imports: ImportDecision;
  notice: BillingNotice | null;
  /** Clients in the workspace, for the Agency plan's soft limit. */
  clientCount: number;
}) {
  const known = subscription !== "unavailable" ? subscription : null;
  const live = known !== null && isLive(known.status);
  const canSubscribe = subscription !== "unavailable" && !live && intervals.length > 0;
  const canManage = portalConfigured && known !== null;
  const atAgencyLimit =
    known !== null && known.plan === "agency" && live && clientCount >= AGENCY_CLIENT_LIMIT;

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
      {imports.allowed && imports.reason === "grace" ? (
        <p className="mt-3 text-sm leading-5 text-ink-secondary">
          Imports continue until {formatDay(imports.graceEndsAt)} while the payment is retried.
          Update the card in Manage billing to keep them running after that.
        </p>
      ) : null}
      {atAgencyLimit ? (
        <p className="mt-3 text-sm leading-5 text-ink-secondary">
          {clientCount === AGENCY_CLIENT_LIMIT
            ? `This workspace has ${AGENCY_CLIENT_LIMIT} client accounts, the most the Agency plan includes.`
            : `This workspace has ${clientCount} client accounts; the Agency plan includes up to ${AGENCY_CLIENT_LIMIT}.`}{" "}
          Nothing is blocked. More than {AGENCY_CLIENT_LIMIT} client accounts is the Enterprise
          plan, priced on request; see{" "}
          <Link
            href="/pricing"
            className="font-medium text-ink underline decoration-border-strong underline-offset-2 hover:decoration-ink"
          >
            pricing
          </Link>
          .
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

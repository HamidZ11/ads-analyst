import type { BillingInterval } from "@/data/supabase/billing";
import { configuredOrigin } from "@/lib/site";

/**
 * Billing configuration, read from server-only environment variables
 * (D-083). Every piece is optional: whatever is missing switches the
 * matching feature off, and anything that would depend on it is hidden
 * (D-062), never rendered as a dead link.
 */

type Env = Record<string, string | undefined>;

/**
 * STRIPE_SECRET_KEY when this deployment may use it, otherwise null. Test
 * keys (`sk_test_`) always may. A live key (`sk_live_`) needs a production
 * build *and* BILLING_LIVE=true, so a live key copied into a development or
 * preview environment can never start a real charge. Anything else
 * (restricted keys, publishable keys, typos) is refused.
 */
export function stripeSecretKey(env: Env = process.env): string | null {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key) return null;
  if (/^sk_test_[A-Za-z0-9]+$/.test(key)) return key;
  if (/^sk_live_[A-Za-z0-9]+$/.test(key) && liveBillingAllowed(env)) return key;
  return null;
}

/** Live charges need both: a production build and the owner's explicit switch. */
export function liveBillingAllowed(env: Env = process.env): boolean {
  return env.NODE_ENV === "production" && env.BILLING_LIVE === "true";
}

/** Why a configured key is refused, for one clear server log line. */
export function stripeKeyProblem(env: Env = process.env): string | null {
  const key = env.STRIPE_SECRET_KEY?.trim();
  if (!key || stripeSecretKey(env)) return null;
  if (key.startsWith("sk_live_"))
    return "STRIPE_SECRET_KEY is a live key; live billing needs NODE_ENV=production and BILLING_LIVE=true.";
  return "STRIPE_SECRET_KEY must be a secret key starting with sk_test_ (or sk_live_ for live billing).";
}

const priceId = (raw: string | undefined) => {
  const value = raw?.trim();
  return value && /^price_[A-Za-z0-9]+$/.test(value) ? value : null;
};

/** The Agency price ids, by interval; either may be missing. */
export function agencyPrices(env: Env = process.env): Partial<Record<BillingInterval, string>> {
  const month = priceId(env.STRIPE_PRICE_AGENCY_MONTHLY);
  const year = priceId(env.STRIPE_PRICE_AGENCY_YEARLY);
  return { ...(month ? { month } : {}), ...(year ? { year } : {}) };
}

export interface CheckoutConfig {
  secretKey: string;
  prices: Partial<Record<BillingInterval, string>>;
  /** NEXT_PUBLIC_SITE_URL: success, cancel and portal return URLs. */
  origin: string;
}

/**
 * Everything Checkout and the customer portal need: an allowed secret key,
 * the site origin, and at least one Agency price. Null means billing is not
 * configured, so no Subscribe or Manage billing control is shown.
 */
export function checkoutConfig(env: Env = process.env): CheckoutConfig | null {
  const secretKey = stripeSecretKey(env);
  const origin = configuredOrigin(env);
  const prices = agencyPrices(env);
  if (!secretKey || !origin || (!prices.month && !prices.year)) return null;
  return { secretKey, prices, origin };
}

/** The intervals a Subscribe button can be shown for, monthly first. */
export function checkoutIntervals(config: CheckoutConfig | null): BillingInterval[] {
  if (!config) return [];
  return (["month", "year"] as const).filter((interval) => config.prices[interval]);
}

export interface WebhookConfig {
  secretKey: string;
  /** STRIPE_WEBHOOK_SECRET (`whsec_…`): verifies Stripe's signature. */
  signingSecret: string;
  /** BILLING_WEBHOOK_DB_SECRET: the only credential apply_billing_event accepts. */
  dbSecret: string;
  supabaseUrl: string;
  publishableKey: string;
  prices: Partial<Record<BillingInterval, string>>;
}

/** Null when any piece is missing: the webhook then answers 503 and Stripe retries. */
export function webhookConfig(env: Env = process.env): WebhookConfig | null {
  const secretKey = stripeSecretKey(env);
  const signingSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
  const dbSecret = env.BILLING_WEBHOOK_DB_SECRET?.trim();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (
    !secretKey ||
    !signingSecret?.startsWith("whsec_") ||
    !dbSecret ||
    dbSecret.length < 32 ||
    !supabaseUrl ||
    !publishableKey
  )
    return null;
  return {
    secretKey,
    signingSecret,
    dbSecret,
    supabaseUrl,
    publishableKey,
    prices: agencyPrices(env),
  };
}

/**
 * BILLING_ENFORCE=true asks for import gating. Defaults to off, so nothing
 * locks anyone out until the owner decides.
 */
export function enforcementRequested(env: Env = process.env): boolean {
  return env.BILLING_ENFORCE === "true";
}

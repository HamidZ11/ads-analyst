import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceSubscription } from "@/data/supabase/billing";
import { AGENCY_CLIENT_LIMIT, BillingSection, NOTICES, parseNotice } from "./billing-section";
import { checkoutIdempotencyKey, checkoutRedirect, portalRedirect } from "./checkout";
import {
  agencyPrices,
  checkoutConfig,
  checkoutIntervals,
  enforcementRequested,
  stripeKeyProblem,
  stripeSecretKey,
  webhookConfig,
} from "./config";
import { agencySubscribeTarget } from "./links";
import { GRACE_DAYS, graceEndsAt, importDecision, type BillingRead } from "./policy";
import { isEntitled, periodLine, planLabel, STATUS_LABELS } from "./status";
import type { BillingStripe } from "./stripe";

const TEST_KEY = "sk_test_51Abc";
const LIVE_KEY = "sk_live_51Abc";

const configured = {
  STRIPE_SECRET_KEY: TEST_KEY,
  STRIPE_PRICE_AGENCY_MONTHLY: "price_M",
  STRIPE_PRICE_AGENCY_YEARLY: "price_Y",
  NEXT_PUBLIC_SITE_URL: "https://adanalyst.example",
};

const sub = (overrides: Partial<WorkspaceSubscription> = {}): WorkspaceSubscription => ({
  plan: "agency",
  interval: "month",
  status: "active",
  currentPeriodEnd: "2026-11-30T12:00:00.000Z",
  cancelAtPeriodEnd: false,
  stripeCustomerId: "cus_1",
  paymentFailedAt: null,
  ...overrides,
});

describe("the Stripe key guard", () => {
  it("accepts test keys anywhere", () => {
    for (const NODE_ENV of ["development", "test", "production"])
      expect(stripeSecretKey({ STRIPE_SECRET_KEY: TEST_KEY, NODE_ENV })).toBe(TEST_KEY);
  });

  it("accepts a live key only in production with BILLING_LIVE=true", () => {
    expect(
      stripeSecretKey({
        STRIPE_SECRET_KEY: LIVE_KEY,
        NODE_ENV: "development",
        BILLING_LIVE: "true",
      }),
    ).toBeNull();
    expect(stripeSecretKey({ STRIPE_SECRET_KEY: LIVE_KEY, NODE_ENV: "production" })).toBeNull();
    expect(
      stripeSecretKey({
        STRIPE_SECRET_KEY: LIVE_KEY,
        NODE_ENV: "production",
        BILLING_LIVE: "1",
      }),
    ).toBeNull();
    expect(
      stripeSecretKey({
        STRIPE_SECRET_KEY: LIVE_KEY,
        NODE_ENV: "production",
        BILLING_LIVE: "true",
      }),
    ).toBe(LIVE_KEY);
  });

  it("refuses anything that isn't a secret key", () => {
    for (const key of [
      "rk_test_51Abc",
      "pk_test_51Abc",
      "rk_live_51Abc",
      "sk_test_",
      "whsec_1",
      "sk_test_a b",
    ])
      expect(
        stripeSecretKey({
          STRIPE_SECRET_KEY: key,
          NODE_ENV: "production",
          BILLING_LIVE: "true",
        }),
        key,
      ).toBeNull();
  });

  it("explains a refused key once, and says nothing when the key is fine or unset", () => {
    expect(stripeKeyProblem({ STRIPE_SECRET_KEY: LIVE_KEY, NODE_ENV: "development" })).toMatch(
      /BILLING_LIVE=true/,
    );
    expect(stripeKeyProblem({ STRIPE_SECRET_KEY: "pk_test_1" })).toMatch(/sk_test_/);
    expect(stripeKeyProblem({ STRIPE_SECRET_KEY: TEST_KEY })).toBeNull();
    expect(stripeKeyProblem({})).toBeNull();
  });

  it("never starts Checkout with a refused key", async () => {
    const stripe = vi.fn();
    const config = checkoutConfig({
      ...configured,
      STRIPE_SECRET_KEY: LIVE_KEY,
      NODE_ENV: "development",
    });
    expect(config).toBeNull();
    const target = await checkoutRedirect({
      config,
      stripe,
      interval: "month",
      workspaceId: "ws",
      email: null,
      subscription: null,
    });
    expect(target).toBe("/settings?billing=unavailable#billing");
    expect(stripe).not.toHaveBeenCalled();
  });
});

describe("billing configuration", () => {
  it("needs a key, the site origin and at least one valid price", () => {
    expect(checkoutConfig(configured)).toEqual({
      secretKey: TEST_KEY,
      prices: { month: "price_M", year: "price_Y" },
      origin: "https://adanalyst.example",
    });
    expect(checkoutConfig({ ...configured, STRIPE_SECRET_KEY: undefined })).toBeNull();
    expect(checkoutConfig({ ...configured, NEXT_PUBLIC_SITE_URL: undefined })).toBeNull();
    expect(
      checkoutConfig({
        ...configured,
        STRIPE_PRICE_AGENCY_MONTHLY: "",
        STRIPE_PRICE_AGENCY_YEARLY: "prod_1",
      }),
    ).toBeNull();
    expect(agencyPrices({ STRIPE_PRICE_AGENCY_YEARLY: "price_Y" })).toEqual({
      year: "price_Y",
    });
  });

  it("offers a Subscribe interval only for each configured price", () => {
    expect(checkoutIntervals(checkoutConfig(configured))).toEqual(["month", "year"]);
    expect(
      checkoutIntervals(
        checkoutConfig({ ...configured, STRIPE_PRICE_AGENCY_MONTHLY: undefined }),
      ),
    ).toEqual(["year"]);
    expect(checkoutIntervals(null)).toEqual([]);
  });

  it("configures the webhook only with every secret it needs", () => {
    const env = {
      ...configured,
      STRIPE_WEBHOOK_SECRET: "whsec_1",
      BILLING_WEBHOOK_DB_SECRET: "x".repeat(32),
      NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_1",
    };
    expect(webhookConfig(env)).toMatchObject({
      signingSecret: "whsec_1",
      dbSecret: "x".repeat(32),
    });
    expect(webhookConfig({ ...env, STRIPE_WEBHOOK_SECRET: "secret" })).toBeNull();
    expect(webhookConfig({ ...env, BILLING_WEBHOOK_DB_SECRET: "short" })).toBeNull();
    expect(webhookConfig({ ...env, NEXT_PUBLIC_SUPABASE_URL: undefined })).toBeNull();
    expect(webhookConfig({ ...env, STRIPE_SECRET_KEY: LIVE_KEY })).toBeNull();
  });

  it("leaves enforcement off unless BILLING_ENFORCE is exactly true", () => {
    expect(enforcementRequested({})).toBe(false);
    expect(enforcementRequested({ BILLING_ENFORCE: "1" })).toBe(false);
    expect(enforcementRequested({ BILLING_ENFORCE: "true" })).toBe(true);
  });
});

describe("import gating policy", () => {
  const NOW = new Date("2026-11-10T12:00:00.000Z");
  const decide = (
    enforce: boolean,
    subscription: BillingRead,
    checkoutConfigured = true,
    now = NOW,
  ) => importDecision({ enforce, checkoutConfigured, subscription, now });

  it("allows every import while enforcement is off, whatever the subscription", () => {
    for (const subscription of [
      null,
      "unavailable" as const,
      sub({ status: "canceled" }),
      sub(),
    ])
      expect(decide(false, subscription)).toEqual({ allowed: true, reason: "not_enforced" });
  });

  it("allows imports when enforcement is on but nobody could subscribe", () => {
    expect(decide(true, null, false)).toEqual({ allowed: true, reason: "not_enforced" });
  });

  it("with enforcement on, allows only active and trialing subscriptions", () => {
    expect(decide(true, sub({ status: "active" }))).toEqual({
      allowed: true,
      reason: "subscribed",
    });
    expect(decide(true, sub({ status: "trialing" }))).toEqual({
      allowed: true,
      reason: "subscribed",
    });
    for (const status of [
      "past_due",
      "unpaid",
      "paused",
      "incomplete",
      "incomplete_expired",
      "canceled",
    ] as const)
      expect(decide(true, sub({ status })), status).toEqual({
        allowed: false,
        reason: "inactive",
      });
    expect(decide(true, null)).toEqual({ allowed: false, reason: "no_subscription" });
  });

  it("fails closed when the subscription can't be read", () => {
    expect(decide(true, "unavailable")).toEqual({ allowed: false, reason: "unknown" });
  });
});

describe("status wording", () => {
  it("labels every status and names entitlement", () => {
    expect(STATUS_LABELS.canceled).toBe("Cancelled");
    expect(STATUS_LABELS.past_due).toBe("Payment overdue");
    expect(isEntitled("trialing")).toBe(true);
    expect(isEntitled("past_due")).toBe(false);
  });

  it("describes the plan and the period honestly", () => {
    expect(planLabel("agency", "year")).toBe("Agency · yearly");
    expect(planLabel("custom", null)).toBe("Custom");
    expect(periodLine(sub())).toBe("Renews 30 Nov 2026");
    expect(periodLine(sub({ cancelAtPeriodEnd: true }))).toBe("Ends 30 Nov 2026");
    expect(periodLine(sub({ status: "canceled" }))).toBeNull();
    expect(periodLine(sub({ currentPeriodEnd: null }))).toBeNull();
  });
});

describe("Checkout and the portal", () => {
  const fake = () => {
    const client = {
      createCheckoutSession: vi.fn(async () => ({
        url: "https://checkout.stripe.com/c/pay/cs_test_1",
      })),
      createPortalSession: vi.fn(async () => ({
        url: "https://billing.stripe.com/p/session/test_1",
      })),
      retrieveSubscription: vi.fn(),
      subscriptionStatuses: vi.fn(async (): Promise<string[]> => []),
    } satisfies BillingStripe;
    return { client, factory: vi.fn(() => client) };
  };

  it("starts a subscription Checkout for the workspace with Settings as the way back", async () => {
    const { client, factory } = fake();
    const target = await checkoutRedirect({
      config: checkoutConfig(configured),
      stripe: factory,
      interval: "year",
      workspaceId: "ws_1",
      email: "ana@agency.test",
      subscription: null,
      now: new Date("2026-10-30T12:04:00Z"),
    });
    expect(target).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
    expect(factory).toHaveBeenCalledWith(TEST_KEY);
    expect(client.subscriptionStatuses).toHaveBeenCalledWith({
      workspaceId: "ws_1",
      customerId: null,
    });
    expect(client.createCheckoutSession).toHaveBeenCalledWith({
      priceId: "price_Y",
      workspaceId: "ws_1",
      customerId: null,
      customerEmail: "ana@agency.test",
      successUrl: "https://adanalyst.example/settings?billing=success#billing",
      cancelUrl: "https://adanalyst.example/settings?billing=cancelled#billing",
      idempotencyKey: checkoutIdempotencyKey(
        "ws_1",
        "price_Y",
        new Date("2026-10-30T12:04:00Z"),
      ),
    });
  });

  it("refuses a second Checkout while Stripe already holds a live subscription the webhook hasn't stored", async () => {
    for (const status of ["active", "trialing", "incomplete", "past_due"]) {
      const { client, factory } = fake();
      client.subscriptionStatuses.mockResolvedValueOnce(["canceled", status]);
      expect(
        await checkoutRedirect({
          config: checkoutConfig(configured),
          stripe: factory,
          interval: "month",
          workspaceId: "ws_1",
          email: null,
          subscription: sub({ status: "canceled", stripeCustomerId: "cus_old" }),
        }),
      ).toBe("https://adanalyst.example/settings?billing=active#billing");
      expect(client.subscriptionStatuses).toHaveBeenCalledWith({
        workspaceId: "ws_1",
        customerId: "cus_old",
      });
      expect(client.createCheckoutSession).not.toHaveBeenCalled();
    }
  });

  it("starts Checkout when Stripe's subscriptions for the workspace have all ended", async () => {
    const { client, factory } = fake();
    client.subscriptionStatuses.mockResolvedValueOnce(["canceled", "incomplete_expired"]);
    expect(
      await checkoutRedirect({
        config: checkoutConfig(configured),
        stripe: factory,
        interval: "month",
        workspaceId: "ws_1",
        email: null,
        subscription: null,
      }),
    ).toBe("https://checkout.stripe.com/c/pay/cs_test_1");
  });

  it("does not start Checkout when Stripe's subscriptions cannot be read", async () => {
    const { client, factory } = fake();
    client.subscriptionStatuses.mockRejectedValueOnce(new Error("search unavailable"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await checkoutRedirect({
        config: checkoutConfig(configured),
        stripe: factory,
        interval: "month",
        workspaceId: "ws_1",
        email: null,
        subscription: null,
      }),
    ).toBe("https://adanalyst.example/settings?billing=error#billing");
    quiet.mockRestore();
    expect(client.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("keys Checkout per workspace, price and ten-minute window", () => {
    const at = (iso: string) => new Date(iso);
    const key = checkoutIdempotencyKey("ws_1", "price_M", at("2026-10-30T12:00:00Z"));
    expect(checkoutIdempotencyKey("ws_1", "price_M", at("2026-10-30T12:09:59Z"))).toBe(key);
    expect(checkoutIdempotencyKey("ws_1", "price_M", at("2026-10-30T12:10:00Z"))).not.toBe(key);
    expect(checkoutIdempotencyKey("ws_2", "price_M", at("2026-10-30T12:00:00Z"))).not.toBe(key);
    expect(checkoutIdempotencyKey("ws_1", "price_Y", at("2026-10-30T12:00:00Z"))).not.toBe(key);
  });

  it("reuses the workspace's customer after a cancellation", async () => {
    const { client, factory } = fake();
    await checkoutRedirect({
      config: checkoutConfig(configured),
      stripe: factory,
      interval: "month",
      workspaceId: "ws_1",
      email: "ana@agency.test",
      subscription: sub({ status: "canceled", stripeCustomerId: "cus_old" }),
    });
    expect(client.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: "cus_old", priceId: "price_M" }),
    );
  });

  it("sends a workspace with a live subscription to Settings instead of a second Checkout", async () => {
    const { client, factory } = fake();
    for (const status of ["active", "past_due", "trialing"] as const)
      expect(
        await checkoutRedirect({
          config: checkoutConfig(configured),
          stripe: factory,
          interval: "month",
          workspaceId: "ws_1",
          email: null,
          subscription: sub({ status }),
        }),
      ).toBe("https://adanalyst.example/settings?billing=active#billing");
    expect(client.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses an interval without a price and reports Stripe failures without detail", async () => {
    const { factory, client } = fake();
    expect(
      await checkoutRedirect({
        config: checkoutConfig({ ...configured, STRIPE_PRICE_AGENCY_YEARLY: undefined }),
        stripe: factory,
        interval: "year",
        workspaceId: "ws_1",
        email: null,
        subscription: null,
      }),
    ).toBe("https://adanalyst.example/settings?billing=unavailable#billing");
    client.createCheckoutSession.mockRejectedValueOnce(
      new Error("card_declined: secret detail"),
    );
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      await checkoutRedirect({
        config: checkoutConfig(configured),
        stripe: factory,
        interval: "month",
        workspaceId: "ws_1",
        email: null,
        subscription: null,
      }),
    ).toBe("https://adanalyst.example/settings?billing=error#billing");
    quiet.mockRestore();
  });

  it("opens the portal for the workspace's customer only", async () => {
    const { client, factory } = fake();
    expect(
      await portalRedirect({
        config: checkoutConfig(configured),
        stripe: factory,
        subscription: sub(),
      }),
    ).toBe("https://billing.stripe.com/p/session/test_1");
    expect(client.createPortalSession).toHaveBeenCalledWith({
      customerId: "cus_1",
      returnUrl: "https://adanalyst.example/settings#billing",
    });
    expect(
      await portalRedirect({
        config: checkoutConfig(configured),
        stripe: factory,
        subscription: null,
      }),
    ).toBe("https://adanalyst.example/settings?billing=unavailable#billing");
    expect(await portalRedirect({ config: null, stripe: factory, subscription: sub() })).toBe(
      "/settings?billing=unavailable#billing",
    );
    expect(client.createPortalSession).toHaveBeenCalledTimes(1);
  });
});

describe("dead-link rules", () => {
  const render = (props: Partial<Parameters<typeof BillingSection>[0]> = {}) =>
    renderToStaticMarkup(
      createElement(BillingSection, {
        subscription: null,
        intervals: ["month", "year"],
        portalConfigured: true,
        imports: { allowed: true, reason: "not_enforced" },
        notice: null,
        clientCount: 3,
        ...props,
      }),
    );

  it("shows no billing control at all when billing isn't configured", () => {
    const html = render({ intervals: [], portalConfigured: false, subscription: sub() });
    expect(html).toContain("Billing isn’t connected in this deployment yet.");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("Subscribe");
    expect(html).not.toContain("Manage billing");
  });

  it("offers Subscribe for each configured interval, monthly as the one primary", () => {
    const html = render();
    expect(html).toContain("No subscription");
    expect(html).toContain('action="/api/billing/checkout"');
    expect(html.match(/name="interval"/g)).toHaveLength(2);
    expect(html).toMatch(
      /value="month" class="[^"]*bg-accent [^"]*" name="interval">Subscribe monthly/,
    );
    expect(html).toMatch(
      /value="year" class="[^"]*bg-surface [^"]*" name="interval">Subscribe yearly/,
    );
    expect(html).not.toContain("Manage billing");
    expect(render({ intervals: ["year"] })).not.toContain("Subscribe monthly");
  });

  it("offers Manage billing, not Subscribe, for a live subscription", () => {
    for (const status of ["active", "past_due", "paused"] as const) {
      const html = render({ subscription: sub({ status }) });
      expect(html, status).toContain('action="/api/billing/portal"');
      expect(html, status).not.toContain("Subscribe");
    }
    const html = render({ subscription: sub({ cancelAtPeriodEnd: true }) });
    expect(html).toContain("Agency · monthly");
    expect(html).toContain("Ends 30 Nov 2026");
  });

  it("offers both after a cancellation, since the customer still exists", () => {
    const html = render({ subscription: sub({ status: "canceled" }) });
    expect(html).toContain("Cancelled");
    expect(html).toContain("Subscribe monthly");
    expect(html).toContain("Manage billing");
  });

  it("shows no action when the subscription couldn't be read", () => {
    const html = render({ subscription: "unavailable" });
    expect(html).toContain("Couldn&#x27;t be loaded");
    expect(html).not.toContain("<form");
  });

  it("explains paused imports, and shows the return notice as a status", () => {
    const html = render({
      imports: { allowed: false, reason: "no_subscription" },
      notice: "cancelled",
    });
    expect(html).toContain(
      "Imports are paused until this workspace has an active subscription.",
    );
    expect(html).toContain(`role="status"`);
    expect(html).toContain(NOTICES.cancelled);
    expect(parseNotice("success")).toBe("success");
    expect(parseNotice("owner")).toBe("owner");
    expect(parseNotice("<script>")).toBeNull();
    expect(parseNotice(["success"])).toBeNull();
  });

  it("routes the pricing Subscribe to Checkout, else the payment link, else nowhere", () => {
    expect(
      agencySubscribeTarget({
        checkoutConfigured: true,
        paymentLink: "https://buy.stripe.com/x",
      }),
    ).toEqual({
      kind: "checkout",
      href: "/sign-in?next=%2Fsettings%23billing",
    });
    expect(
      agencySubscribeTarget({
        checkoutConfigured: false,
        paymentLink: "https://buy.stripe.com/x",
      }),
    ).toEqual({
      kind: "payment_link",
      href: "https://buy.stripe.com/x",
    });
    expect(agencySubscribeTarget({ checkoutConfigured: false, paymentLink: null })).toBeNull();
  });
});

describe("pricing page with Checkout configured", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function render(env: Record<string, string>) {
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    vi.resetModules();
    const { default: Page } = await import("@/app/(marketing)/pricing/page");
    return renderToStaticMarkup(createElement(Page));
  }

  it("sends Agency's Subscribe to the in-app billing section, ahead of a payment link", async () => {
    const html = await render({
      ...configured,
      NEXT_PUBLIC_STRIPE_PAYMENT_LINK: "https://buy.stripe.com/test_123",
    });
    expect(html).toMatch(
      /<a class="[^"]*button[^"]*" href="\/sign-in\?next=%2Fsettings%23billing">Subscribe<\/a>/,
    );
    expect(html).not.toContain("buy.stripe.com");
  });

  it("falls back to the payment link when the key is refused", async () => {
    const html = await render({
      ...configured,
      STRIPE_SECRET_KEY: LIVE_KEY,
      NEXT_PUBLIC_STRIPE_PAYMENT_LINK: "https://buy.stripe.com/test_123",
    });
    expect(html).toContain('href="https://buy.stripe.com/test_123"');
    expect(html).not.toContain("settings%23billing");
  });

  it("never shows the payment link once Checkout is configured, monthly or yearly only", async () => {
    for (const prices of [
      { STRIPE_PRICE_AGENCY_YEARLY: "" },
      { STRIPE_PRICE_AGENCY_MONTHLY: "" },
    ]) {
      const html = await render({
        ...configured,
        ...prices,
        NEXT_PUBLIC_STRIPE_PAYMENT_LINK: "https://buy.stripe.com/test_123",
      });
      expect(html).toContain("settings%23billing");
      expect(html).not.toContain("buy.stripe.com");
    }
  });
});

describe("grace period after a failed payment", () => {
  const failedAt = "2026-11-03T09:00:00.000Z";
  const ends = new Date("2026-11-10T09:00:00.000Z");
  const decide = (subscription: BillingRead, now: Date, enforce = true, checkout = true) =>
    importDecision({ enforce, checkoutConfigured: checkout, subscription, now });

  it("keeps imports open for 7 days after the first failure while past due or unpaid", () => {
    for (const status of ["past_due", "unpaid"] as const) {
      const subscription = sub({ status, paymentFailedAt: failedAt });
      expect(graceEndsAt(subscription)).toEqual(ends);
      expect(decide(subscription, new Date(ends.getTime() - 1))).toEqual({
        allowed: true,
        reason: "grace",
        graceEndsAt: ends.toISOString(),
      });
      expect(decide(subscription, ends)).toEqual({ allowed: false, reason: "inactive" });
    }
    expect(GRACE_DAYS).toBe(7);
  });

  it("gives no grace without a recorded failure, or in any other status", () => {
    const now = new Date("2026-11-04T00:00:00.000Z");
    expect(decide(sub({ status: "past_due" }), now)).toEqual({
      allowed: false,
      reason: "inactive",
    });
    for (const status of ["canceled", "incomplete", "incomplete_expired", "paused"] as const)
      expect(decide(sub({ status, paymentFailedAt: failedAt }), now), status).toEqual({
        allowed: false,
        reason: "inactive",
      });
    expect(graceEndsAt(sub({ status: "past_due", paymentFailedAt: "not a date" }))).toBeNull();
  });

  it("changes nothing while gating is off or Checkout isn't configured", () => {
    const subscription = sub({
      status: "past_due",
      paymentFailedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(decide(subscription, ends, false)).toEqual({
      allowed: true,
      reason: "not_enforced",
    });
    expect(decide(subscription, ends, true, false)).toEqual({
      allowed: true,
      reason: "not_enforced",
    });
  });

  it("tells the workspace when imports stop", () => {
    const html = renderToStaticMarkup(
      createElement(BillingSection, {
        subscription: sub({ status: "past_due", paymentFailedAt: failedAt }),
        intervals: ["month"],
        portalConfigured: true,
        imports: { allowed: true, reason: "grace", graceEndsAt: ends.toISOString() },
        notice: null,
        clientCount: 2,
      }),
    );
    expect(html).toContain("Imports continue until 10 Nov 2026");
    expect(html).not.toContain("Imports are paused");
  });
});

describe("the Agency plan's client accounts", () => {
  const render = (clientCount: number, subscription: BillingRead = sub()) =>
    renderToStaticMarkup(
      createElement(BillingSection, {
        subscription,
        intervals: ["month"],
        portalConfigured: true,
        imports: { allowed: true, reason: "not_enforced" },
        notice: null,
        clientCount,
      }),
    );

  it("shows a soft notice from 10 client accounts and blocks nothing", () => {
    expect(render(9)).not.toContain("client accounts");
    expect(render(10)).toContain(
      "This workspace has 10 client accounts, the most the Agency plan includes.",
    );
    const over = render(14);
    expect(over).toContain(
      "This workspace has 14 client accounts; the Agency plan includes up to 10.",
    );
    expect(over).toContain("Nothing is blocked.");
    expect(over).toContain('href="/pricing"');
    expect(AGENCY_CLIENT_LIMIT).toBe(10);
  });

  it("only on a live Agency subscription", () => {
    expect(render(12, sub({ plan: "custom" }))).not.toContain("client accounts");
    expect(render(12, sub({ status: "canceled" }))).not.toContain("client accounts");
    expect(render(12, null)).not.toContain("client accounts");
  });
});

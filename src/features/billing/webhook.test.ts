import Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import type { BillingWriter } from "@/data/supabase/billing";
import {
  addUser,
  createTestDatabase,
  setBillingSecret,
  sqlBillingWriter,
  sqlGateway,
} from "@/data/supabase/test-database";
import type { BillingStripe, StripeSubscriptionLike } from "./stripe";
import { handleStripeWebhook, subscriptionState } from "./webhook";

/**
 * The webhook with a fake Stripe client and real signatures: Stripe's own
 * test-header helper signs each payload offline, and verification is the
 * same code that runs in production. Nothing reaches Stripe or Supabase.
 */

const SIGNING = "whsec_test_signing_secret";
const WS = "6f1c1f5e-0d8a-4c35-9a52-1b1f2a3c4d5e";
const PRICES = { month: "price_AgencyMonthly", year: "price_AgencyYearly" };

const subscription = (
  overrides: Partial<StripeSubscriptionLike> = {},
): StripeSubscriptionLike => ({
  id: "sub_1",
  customer: "cus_1",
  status: "active",
  metadata: { workspace_id: WS },
  cancel_at_period_end: false,
  cancel_at: null,
  items: {
    data: [
      {
        current_period_end: 1_796_040_000, // 2026-11-30T12:00:00Z
        price: { id: PRICES.month, recurring: { interval: "month" } },
      },
    ],
  },
  ...overrides,
});

function fakeStripe(sub: StripeSubscriptionLike | Error = subscription()) {
  return {
    createCheckoutSession: vi.fn(),
    createPortalSession: vi.fn(),
    retrieveSubscription: vi.fn(async () => {
      if (sub instanceof Error) throw sub;
      return sub;
    }),
  } satisfies BillingStripe;
}

const fakeWriter = () =>
  ({ applyEvent: vi.fn(async () => "applied" as const) }) satisfies BillingWriter;

function event(
  type: string,
  object: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  return JSON.stringify({
    id: "evt_1",
    object: "event",
    type,
    livemode: false,
    created: 1_793_000_000,
    data: { object },
    ...overrides,
  });
}

const sign = (payload: string, secret = SIGNING, timestamp?: number) =>
  Stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp });

async function deliver(
  rawBody: string,
  options: {
    signature?: string | null;
    stripe?: BillingStripe;
    writer?: BillingWriter;
    live?: boolean;
  } = {},
) {
  const stripe = options.stripe ?? fakeStripe();
  const writer = options.writer ?? fakeWriter();
  const result = await handleStripeWebhook({
    rawBody,
    signature: options.signature === undefined ? sign(rawBody) : options.signature,
    signingSecret: SIGNING,
    live: options.live ?? false,
    prices: PRICES,
    stripe,
    writer,
  });
  return { result, stripe, writer };
}

const subscriptionEvent = (type: string) =>
  event(type, { id: "sub_1", object: "subscription" });

describe("signature", () => {
  it("refuses a missing, forged, re-signed or tampered request without touching anything", async () => {
    const body = subscriptionEvent("customer.subscription.updated");
    for (const signature of [
      null,
      "",
      "t=1,v1=deadbeef",
      sign(body, "whsec_someone_else"),
      sign(body.replace('"sub_1"', '"sub_2"')),
    ]) {
      const { result, stripe, writer } = await deliver(body, { signature });
      expect(result.status, String(signature)).toBe(400);
      expect(stripe.retrieveSubscription).not.toHaveBeenCalled();
      expect(writer.applyEvent).not.toHaveBeenCalled();
    }
  });

  it("refuses a correctly signed but stale delivery (replay)", async () => {
    const body = subscriptionEvent("customer.subscription.updated");
    const { result } = await deliver(body, {
      signature: sign(body, SIGNING, Math.floor(Date.now() / 1000) - 3600),
    });
    expect(result.status).toBe(400);
  });

  it("refuses events from the other Stripe mode", async () => {
    const live = event("customer.subscription.updated", { id: "sub_1" }, { livemode: true });
    expect((await deliver(live)).result.status).toBe(400);
    const test = subscriptionEvent("customer.subscription.updated");
    expect((await deliver(test, { live: true })).result.status).toBe(400);
  });
});

describe("event types", () => {
  it("links the subscription from checkout.session.completed to the workspace in our metadata", async () => {
    const body = event("checkout.session.completed", {
      object: "checkout.session",
      mode: "subscription",
      subscription: "sub_1",
      customer: "cus_1",
      metadata: { workspace_id: WS },
    });
    const stripe = fakeStripe(subscription({ metadata: {} }));
    const { result, writer } = await deliver(body, { stripe });
    expect(result).toEqual({ status: 200, body: { received: true, outcome: "applied" } });
    expect(stripe.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(writer.applyEvent).toHaveBeenCalledWith("evt_1", "checkout.session.completed", {
      workspace_id: WS,
      customer_id: "cus_1",
      subscription_id: "sub_1",
      plan: "agency",
      interval: "month",
      status: "active",
      current_period_end: "2026-11-30T12:00:00.000Z",
      cancel_at_period_end: false,
    });
  });

  it("records a checkout that isn't a subscription without writing any state", async () => {
    const body = event("checkout.session.completed", { mode: "payment", subscription: null });
    const { result, stripe, writer } = await deliver(body);
    expect(result.status).toBe(200);
    expect(stripe.retrieveSubscription).not.toHaveBeenCalled();
    expect(writer.applyEvent).toHaveBeenCalledWith("evt_1", "checkout.session.completed", null);
  });

  it("ignores workspace ids that aren't UUIDs", async () => {
    const body = event("checkout.session.completed", {
      mode: "subscription",
      subscription: "sub_1",
      metadata: { workspace_id: "'; drop table x;--" },
    });
    const { writer } = await deliver(body, {
      stripe: fakeStripe(subscription({ metadata: {} })),
    });
    expect(writer.applyEvent).toHaveBeenCalledWith(
      "evt_1",
      "checkout.session.completed",
      expect.objectContaining({ workspace_id: null }),
    );
  });

  it.each([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
  ])("applies %s from the subscription as Stripe has it now", async (type) => {
    const stripe = fakeStripe(
      subscription({ status: type.endsWith("deleted") ? "canceled" : "active" }),
    );
    const { result, writer } = await deliver(subscriptionEvent(type), { stripe });
    expect(result.status).toBe(200);
    expect(stripe.retrieveSubscription).toHaveBeenCalledWith("sub_1");
    expect(writer.applyEvent).toHaveBeenCalledWith(
      "evt_1",
      type,
      expect.objectContaining({
        workspace_id: WS,
        status: type.endsWith("deleted") ? "canceled" : "active",
      }),
    );
  });

  it("refreshes the subscription on invoice.payment_failed", async () => {
    const body = event("invoice.payment_failed", {
      object: "invoice",
      parent: { type: "subscription_details", subscription_details: { subscription: "sub_1" } },
    });
    const stripe = fakeStripe(subscription({ status: "past_due" }));
    const { writer } = await deliver(body, { stripe });
    expect(writer.applyEvent).toHaveBeenCalledWith(
      "evt_1",
      "invoice.payment_failed",
      expect.objectContaining({ status: "past_due" }),
    );
  });

  it("records a failed invoice that belongs to no subscription without writing state", async () => {
    const body = event("invoice.payment_failed", { object: "invoice", parent: null });
    const { stripe, writer } = await deliver(body);
    expect(stripe.retrieveSubscription).not.toHaveBeenCalled();
    expect(writer.applyEvent).toHaveBeenCalledWith("evt_1", "invoice.payment_failed", null);
  });

  it("acknowledges other event types without touching Stripe or the database", async () => {
    const { result, stripe, writer } = await deliver(event("charge.refunded", { id: "ch_1" }));
    expect(result).toEqual({ status: 200, body: { received: true, outcome: "ignored" } });
    expect(stripe.retrieveSubscription).not.toHaveBeenCalled();
    expect(writer.applyEvent).not.toHaveBeenCalled();
  });

  it("answers 500 so Stripe retries when Stripe, the mapping or the database fails", async () => {
    const body = subscriptionEvent("customer.subscription.updated");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await deliver(body, { stripe: fakeStripe(new Error("down")) })).result.status).toBe(
      500,
    );
    expect(
      (await deliver(body, { stripe: fakeStripe(subscription({ status: "brand_new" })) }))
        .result.status,
    ).toBe(500);
    const failing = { applyEvent: vi.fn(async () => Promise.reject(new Error("db"))) };
    expect((await deliver(body, { writer: failing })).result.status).toBe(500);
    quiet.mockRestore();
  });
});

describe("status mapping", () => {
  it("maps Stripe's subscription to the stored row", () => {
    expect(subscriptionState(subscription(), PRICES, null)).toEqual({
      workspace_id: WS,
      customer_id: "cus_1",
      subscription_id: "sub_1",
      plan: "agency",
      interval: "month",
      status: "active",
      current_period_end: "2026-11-30T12:00:00.000Z",
      cancel_at_period_end: false,
    });
  });

  it("calls only the configured Agency prices agency; anything else is custom", () => {
    const yearly = subscription({
      items: {
        data: [
          {
            current_period_end: null,
            price: { id: PRICES.year, recurring: { interval: "year" } },
          },
        ],
      },
    });
    expect(subscriptionState(yearly, PRICES, null)).toMatchObject({
      plan: "agency",
      interval: "year",
      current_period_end: null,
    });
    const enterprise = subscription({
      items: {
        data: [
          {
            current_period_end: null,
            price: { id: "price_Other", recurring: { interval: "week" } },
          },
        ],
      },
    });
    expect(subscriptionState(enterprise, PRICES, null)).toMatchObject({
      plan: "custom",
      interval: null,
    });
  });

  it("reads a scheduled cancellation either way Stripe records it", () => {
    expect(
      subscriptionState(subscription({ cancel_at_period_end: true }), PRICES, null)
        .cancel_at_period_end,
    ).toBe(true);
    expect(
      subscriptionState(subscription({ cancel_at: 1_796_040_000 }), PRICES, null)
        .cancel_at_period_end,
    ).toBe(true);
  });

  it("prefers the checkout's workspace and accepts an expanded customer", () => {
    const other = "11111111-2222-4333-8444-555555555555";
    expect(
      subscriptionState(subscription({ customer: { id: "cus_9" } }), PRICES, other),
    ).toMatchObject({ workspace_id: other, customer_id: "cus_9" });
  });

  it.each([
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
  ])("keeps Stripe's %s status", (status) => {
    expect(subscriptionState(subscription({ status }), PRICES, null).status).toBe(status);
  });
});

describe("end to end over the real write path", () => {
  it("stores each event's state once, and a redelivered event changes nothing", async () => {
    const db = await createTestDatabase();
    const ANA = "00000000-0000-4000-8000-00000000000a";
    await addUser(db, ANA, "ana@agency.test");
    const ana = sqlGateway(db, ANA);
    const [ws] = await ana.ensureWorkspaces("Ana's workspace");
    const secret = "test-db-secret-0123456789abcdefghijklmnop";
    await setBillingSecret(db, secret);
    const writer = sqlBillingWriter(db, secret);
    const withWs = (status: string, extra: Partial<StripeSubscriptionLike> = {}) =>
      fakeStripe(subscription({ status, metadata: { workspace_id: ws.id }, ...extra }));

    const checkout = event("checkout.session.completed", {
      mode: "subscription",
      subscription: "sub_1",
      metadata: { workspace_id: ws.id },
    });
    expect(
      (await deliver(checkout, { stripe: withWs("active"), writer })).result.body.outcome,
    ).toBe("applied");
    expect((await ana.subscription(ws.id))?.status).toBe("active");

    const failed = event(
      "invoice.payment_failed",
      { parent: { subscription_details: { subscription: "sub_1" } } },
      { id: "evt_2" },
    );
    await deliver(failed, { stripe: withWs("past_due"), writer });
    expect((await ana.subscription(ws.id))?.status).toBe("past_due");

    // Stripe redelivers the checkout event: a no-op, even though the fake
    // would now report the subscription as active again.
    const again = await deliver(checkout, { stripe: withWs("active"), writer });
    expect(again.result).toEqual({
      status: 200,
      body: { received: true, outcome: "duplicate" },
    });
    expect((await ana.subscription(ws.id))?.status).toBe("past_due");

    const deleted = event("customer.subscription.deleted", { id: "sub_1" }, { id: "evt_3" });
    await deliver(deleted, { stripe: withWs("canceled"), writer });
    expect((await ana.subscription(ws.id))?.status).toBe("canceled");
  });
});

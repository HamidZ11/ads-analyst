import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkspaceGateway } from "@/data/supabase/gateway";
import { accessDecision } from "@/features/auth/access";
import { loadSession, type SessionState } from "@/features/workspace/server";
import { POST as checkout } from "./checkout/route";
import { POST as portal } from "./portal/route";
import { POST as webhook } from "./webhook/route";

/**
 * The billing routes with a fake session, a fake Stripe client and a fake
 * database writer. The webhook's signature check is the real one
 * (exercised in webhook.test.ts); here it proves the route reads the raw
 * body and is reachable without a session.
 */

vi.mock("@/features/workspace/server", () => ({ loadSession: vi.fn() }));
const stripe = vi.hoisted(() => ({
  createCheckoutSession: vi.fn(),
  createPortalSession: vi.fn(),
  retrieveSubscription: vi.fn(),
  subscriptionStatuses: vi.fn(),
}));
vi.mock("@/features/billing/stripe", async (original) => ({
  ...(await original<typeof import("@/features/billing/stripe")>()),
  stripeClient: vi.fn(() => stripe),
}));
const writer = vi.hoisted(() => ({ applyEvent: vi.fn() }));
vi.mock("@/data/supabase/billing", async (original) => ({
  ...(await original<typeof import("@/data/supabase/billing")>()),
  supabaseBillingWriter: vi.fn(() => writer),
}));

const gateway = {
  ensureWorkspaces: vi.fn(),
  snapshot: vi.fn(),
  importMetaCsv: vi.fn(),
  updateTargets: vi.fn(),
  renameWorkspace: vi.fn(),
  reportNote: vi.fn(),
  saveReportNote: vi.fn(),
  consumeRateLimit: vi.fn(),
  subscription: vi.fn(),
} satisfies WorkspaceGateway;

const session = {
  kind: "app",
  gateway,
  context: {
    mode: "supabase",
    canImport: true,
    clients: [],
    user: { id: "u1", email: "ana@agency.test" },
    workspace: { id: "6f1c1f5e-0d8a-4c35-9a52-1b1f2a3c4d5e", name: "Ana's workspace" },
  },
} as unknown as SessionState;

const ENV = {
  STRIPE_SECRET_KEY: "sk_test_51Abc",
  STRIPE_PRICE_AGENCY_MONTHLY: "price_M",
  STRIPE_PRICE_AGENCY_YEARLY: "price_Y",
  NEXT_PUBLIC_SITE_URL: "https://adanalyst.example",
  STRIPE_WEBHOOK_SECRET: "whsec_test_route",
  BILLING_WEBHOOK_DB_SECRET: "x".repeat(40),
  NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
};

const form = (
  path: string,
  fields: Record<string, string> = {},
  origin = "https://adanalyst.example",
) =>
  new Request(`https://adanalyst.example${path}`, {
    method: "POST",
    headers: { origin, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(ENV)) vi.stubEnv(key, value);
  vi.mocked(loadSession).mockResolvedValue(session);
  gateway.subscription.mockResolvedValue(null);
  stripe.subscriptionStatuses.mockResolvedValue([]);
  stripe.createCheckoutSession.mockResolvedValue({
    url: "https://checkout.stripe.com/c/pay/cs_test_1",
  });
  stripe.createPortalSession.mockResolvedValue({
    url: "https://billing.stripe.com/p/session/test_1",
  });
});

describe("checkout route", () => {
  it("answers a signed-in form post with a 303 to Stripe Checkout", async () => {
    const response = await checkout(form("/api/billing/checkout", { interval: "month" }));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_test_1",
    );
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        priceId: "price_M",
        workspaceId: "6f1c1f5e-0d8a-4c35-9a52-1b1f2a3c4d5e",
        customerEmail: "ana@agency.test",
      }),
    );
  });

  it("refuses foreign origins and signed-out callers before reaching Stripe", async () => {
    expect(
      (
        await checkout(
          form("/api/billing/checkout", { interval: "month" }, "https://evil.example"),
        )
      ).status,
    ).toBe(403);
    vi.mocked(loadSession).mockResolvedValue({ kind: "signed_out" });
    expect((await checkout(form("/api/billing/checkout", { interval: "month" }))).status).toBe(
      401,
    );
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("sends a bad interval, a demo session or an unreadable subscription back to Settings", async () => {
    const back = "https://adanalyst.example/settings?billing=unavailable#billing";
    expect(
      (await checkout(form("/api/billing/checkout", { interval: "week" }))).headers.get(
        "location",
      ),
    ).toBe(back);
    gateway.subscription.mockRejectedValue(new Error("down"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      (await checkout(form("/api/billing/checkout", { interval: "month" }))).headers.get(
        "location",
      ),
    ).toBe(back);
    quiet.mockRestore();
    vi.mocked(loadSession).mockResolvedValue({
      ...session,
      gateway: null,
      context: { ...(session as { context: object }).context, mode: "demo" },
    } as unknown as SessionState);
    expect(
      (await checkout(form("/api/billing/checkout", { interval: "month" }))).headers.get(
        "location",
      ),
    ).toBe(back);
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses to start Checkout with a live key outside an explicit live production setup", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_51Abc");
    const response = await checkout(form("/api/billing/checkout", { interval: "month" }));
    expect(response.headers.get("location")).toBe(
      "https://adanalyst.example/settings?billing=unavailable#billing",
    );
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });
});

describe("portal route", () => {
  it("opens the portal for the workspace's customer", async () => {
    gateway.subscription.mockResolvedValue({
      plan: "agency",
      interval: "month",
      status: "active",
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false,
      stripeCustomerId: "cus_1",
      paymentFailedAt: null,
    });
    const response = await portal(form("/api/billing/portal"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://billing.stripe.com/p/session/test_1",
    );
    expect(stripe.createPortalSession).toHaveBeenCalledWith({
      customerId: "cus_1",
      returnUrl: "https://adanalyst.example/settings#billing",
    });
  });

  it("has nothing to open for a workspace that never subscribed", async () => {
    const response = await portal(form("/api/billing/portal"));
    expect(response.headers.get("location")).toBe(
      "https://adanalyst.example/settings?billing=unavailable#billing",
    );
    expect(stripe.createPortalSession).not.toHaveBeenCalled();
  });
});

describe("webhook route", () => {
  it("is reachable without a session; checkout and the portal are not", () => {
    expect(accessDecision("/api/billing/webhook", false)).toBe("allow");
    expect(accessDecision("/api/billing/checkout", false)).toBe("unauthorized");
    expect(accessDecision("/api/billing/portal", false)).toBe("unauthorized");
  });

  it("answers 503 while billing isn't configured, so Stripe keeps retrying", async () => {
    vi.stubEnv("BILLING_WEBHOOK_DB_SECRET", "");
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await webhook(
      new Request("https://adanalyst.example/api/billing/webhook", {
        method: "POST",
        body: "{}",
      }),
    );
    expect(response.status).toBe(503);
    quiet.mockRestore();
  });

  it("refuses an unsigned body without reading the session, Stripe or the database", async () => {
    const response = await webhook(
      new Request("https://adanalyst.example/api/billing/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=forged" },
        body: JSON.stringify({
          id: "evt_1",
          type: "customer.subscription.updated",
          data: { object: { id: "sub_1" } },
        }),
      }),
    );
    expect(response.status).toBe(400);
    expect(loadSession).not.toHaveBeenCalled();
    expect(stripe.retrieveSubscription).not.toHaveBeenCalled();
    expect(writer.applyEvent).not.toHaveBeenCalled();
  });

  it("verifies the raw body Stripe signed and hands the event to the writer", async () => {
    const { default: Stripe } = await import("stripe");
    const body = JSON.stringify({
      id: "evt_1",
      object: "event",
      type: "customer.subscription.updated",
      livemode: false,
      data: { object: { id: "sub_1" } },
    });
    stripe.retrieveSubscription.mockResolvedValue({
      id: "sub_1",
      customer: "cus_1",
      status: "active",
      metadata: {},
      cancel_at_period_end: false,
      cancel_at: null,
      items: {
        data: [
          {
            current_period_end: null,
            price: { id: "price_Y", recurring: { interval: "year" } },
          },
        ],
      },
    });
    writer.applyEvent.mockResolvedValue("applied");
    const response = await webhook(
      new Request("https://adanalyst.example/api/billing/webhook", {
        method: "POST",
        headers: {
          "stripe-signature": Stripe.webhooks.generateTestHeaderString({
            payload: body,
            secret: ENV.STRIPE_WEBHOOK_SECRET,
          }),
        },
        body,
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, outcome: "applied" });
    expect(writer.applyEvent).toHaveBeenCalledWith(
      "evt_1",
      "customer.subscription.updated",
      expect.objectContaining({ plan: "agency", interval: "year", workspace_id: null }),
    );
  });
});

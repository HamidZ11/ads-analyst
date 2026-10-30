import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The real client wrapper with the stripe package replaced, so nothing
 * reaches Stripe: it checks exactly what would be sent.
 */

const sdk = vi.hoisted(() => ({
  constructed: [] as unknown[][],
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  subscriptions: { retrieve: vi.fn() },
}));
vi.mock("stripe", () => ({
  default: class {
    checkout = sdk.checkout;
    billingPortal = sdk.billingPortal;
    subscriptions = sdk.subscriptions;
    constructor(...args: unknown[]) {
      sdk.constructed.push(args);
    }
  },
}));

const { stripeClient } = await import("./stripe");

beforeEach(() => {
  sdk.constructed.length = 0;
  vi.clearAllMocks();
  sdk.checkout.sessions.create.mockResolvedValue({
    url: "https://checkout.stripe.com/c/pay/cs_test_1",
  });
});

const params = {
  priceId: "price_M",
  workspaceId: "ws_1",
  customerId: null,
  customerEmail: "ana@agency.test",
  successUrl: "https://adanalyst.example/settings?billing=success#billing",
  cancelUrl: "https://adanalyst.example/settings?billing=cancelled#billing",
};

describe("Stripe client", () => {
  it("creates a plain subscription Checkout: one price, our metadata, no trial or discount", async () => {
    await stripeClient("sk_test_51Abc").createCheckoutSession(params);
    expect(sdk.constructed[0][0]).toBe("sk_test_51Abc");
    expect(sdk.checkout.sessions.create).toHaveBeenCalledWith({
      mode: "subscription",
      line_items: [{ price: "price_M", quantity: 1 }],
      client_reference_id: "ws_1",
      metadata: { workspace_id: "ws_1" },
      subscription_data: { metadata: { workspace_id: "ws_1" } },
      customer_email: "ana@agency.test",
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
  });

  it("uses the existing customer instead of an email when there is one", async () => {
    await stripeClient("sk_test_51Abc").createCheckoutSession({
      ...params,
      customerId: "cus_1",
    });
    const sent = sdk.checkout.sessions.create.mock.calls[0][0];
    expect(sent.customer).toBe("cus_1");
    expect(sent).not.toHaveProperty("customer_email");
  });
});

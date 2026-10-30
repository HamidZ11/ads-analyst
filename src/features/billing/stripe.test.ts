import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The real client wrapper with the stripe package replaced, so nothing
 * reaches Stripe: it checks exactly what would be sent.
 */

const sdk = vi.hoisted(() => ({
  constructed: [] as unknown[][],
  checkout: { sessions: { create: vi.fn() } },
  billingPortal: { sessions: { create: vi.fn() } },
  subscriptions: { retrieve: vi.fn(), list: vi.fn(), search: vi.fn() },
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
  idempotencyKey: "checkout:ws_1:price_M:2963664",
};

describe("Stripe client", () => {
  it("creates a plain subscription Checkout: one price, our metadata, no trial or discount", async () => {
    await stripeClient("sk_test_51Abc").createCheckoutSession(params);
    expect(sdk.constructed[0][0]).toBe("sk_test_51Abc");
    expect(sdk.checkout.sessions.create).toHaveBeenCalledWith(
      {
        mode: "subscription",
        line_items: [{ price: "price_M", quantity: 1 }],
        client_reference_id: "ws_1",
        metadata: { workspace_id: "ws_1" },
        subscription_data: { metadata: { workspace_id: "ws_1" } },
        customer_email: "ana@agency.test",
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
      },
      { idempotencyKey: "checkout:ws_1:price_M:2963664" },
    );
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

  it("reads the customer's subscriptions and those carrying the workspace in metadata", async () => {
    sdk.subscriptions.list.mockResolvedValue({
      data: [
        { id: "sub_old", status: "canceled" },
        { id: "sub_new", status: "active" },
      ],
    });
    sdk.subscriptions.search.mockResolvedValue({
      data: [
        { id: "sub_new", status: "active" },
        { id: "sub_tab", status: "incomplete" },
      ],
    });
    const statuses = await stripeClient("sk_test_51Abc").subscriptionStatuses({
      workspaceId: "6f1c1f5e-0d8a-4c35-9a52-1b1f2a3c4d5e",
      customerId: "cus_1",
    });
    expect(statuses).toEqual(["canceled", "active", "incomplete"]);
    expect(sdk.subscriptions.list).toHaveBeenCalledWith({
      customer: "cus_1",
      status: "all",
      limit: 20,
    });
    expect(sdk.subscriptions.search).toHaveBeenCalledWith({
      query: "metadata['workspace_id']:'6f1c1f5e-0d8a-4c35-9a52-1b1f2a3c4d5e'",
      limit: 20,
    });
  });

  it("searches only by metadata without a customer, and never with a quote in the id", async () => {
    sdk.subscriptions.search.mockResolvedValue({ data: [] });
    const client = stripeClient("sk_test_51Abc");
    expect(
      await client.subscriptionStatuses({ workspaceId: "ws_1", customerId: null }),
    ).toEqual([]);
    expect(sdk.subscriptions.list).not.toHaveBeenCalled();
    await expect(
      client.subscriptionStatuses({ workspaceId: "x' OR status:'active", customerId: null }),
    ).rejects.toThrow();
    expect(sdk.subscriptions.search).toHaveBeenCalledTimes(1);
  });
});

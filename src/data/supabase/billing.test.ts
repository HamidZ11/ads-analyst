import { describe, expect, it } from "vitest";
import { GRACE_DAYS, graceEndsAt } from "@/features/billing/policy";
import type { SubscriptionState } from "./billing";
import {
  addUser,
  as,
  createTestDatabase,
  setBillingSecret,
  sqlBillingWriter,
  sqlGateway,
} from "./test-database";

/**
 * Subscription state in Postgres (D-088): members read it through RLS,
 * nobody writes it directly, and the webhook's function accepts writes only
 * with the webhook's database secret, once per event.
 */

const ANA = "00000000-0000-4000-8000-00000000000a";
const BEN = "00000000-0000-4000-8000-00000000000b";
const SECRET = "test-db-secret-0123456789abcdefghijklmnop";

async function seeded() {
  const db = await createTestDatabase();
  await addUser(db, ANA, "ana@agency.test");
  await addUser(db, BEN, "ben@other.test");
  const ana = sqlGateway(db, ANA);
  const ben = sqlGateway(db, BEN);
  const [anaWs] = await ana.ensureWorkspaces("Ana's workspace");
  const [benWs] = await ben.ensureWorkspaces("Ben's workspace");
  await setBillingSecret(db, SECRET);
  return { db, ana, ben, anaWs, benWs, writer: sqlBillingWriter(db, SECRET) };
}

const state = (overrides: Partial<SubscriptionState> = {}): SubscriptionState => ({
  workspace_id: null,
  customer_id: "cus_Ana1",
  subscription_id: "sub_Ana1",
  plan: "agency",
  interval: "month",
  status: "active",
  current_period_end: "2026-11-30T12:00:00.000Z",
  cancel_at_period_end: false,
  ...overrides,
});

const events = async (db: Awaited<ReturnType<typeof seeded>>["db"]) =>
  (
    await db.query<{ id: string; outcome: string }>(
      "select id, outcome from public.billing_events order by processed_at, id",
    )
  ).rows;

describe("subscription reads", () => {
  it("lets members read their own workspace's subscription, and nobody else", async () => {
    const { db, ana, ben, anaWs, writer } = await seeded();
    expect(await ana.subscription(anaWs.id)).toBeNull();
    await writer.applyEvent(
      "evt_1",
      "customer.subscription.created",
      state({ workspace_id: anaWs.id }),
    );
    expect(await ana.subscription(anaWs.id)).toEqual({
      plan: "agency",
      interval: "month",
      status: "active",
      currentPeriodEnd: "2026-11-30T12:00:00.000Z",
      cancelAtPeriodEnd: false,
      stripeCustomerId: "cus_Ana1",
      paymentFailedAt: null,
    });
    // Another tenant sees nothing (RLS), and anonymous callers have no grant.
    expect(await ben.subscription(anaWs.id)).toBeNull();
    await expect(
      as(db, null, () => db.query("select * from public.workspace_subscriptions")),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuses every direct write, even to the member's own row", async () => {
    const { db, anaWs, writer } = await seeded();
    await writer.applyEvent(
      "evt_1",
      "customer.subscription.created",
      state({ workspace_id: anaWs.id }),
    );
    for (const sql of [
      `update public.workspace_subscriptions set status = 'active' where workspace_id = '${anaWs.id}'`,
      `delete from public.workspace_subscriptions where workspace_id = '${anaWs.id}'`,
      `insert into public.workspace_subscriptions (workspace_id, stripe_customer_id, stripe_subscription_id, plan, status)
         values ('${anaWs.id}', 'cus_X', 'sub_X', 'agency', 'active')`,
    ])
      await expect(as(db, ANA, () => db.query(sql))).rejects.toThrow(/permission denied/);
  });

  it("keeps processed events and the secret hash unreadable", async () => {
    const { db } = await seeded();
    for (const user of [ANA, null])
      for (const table of ["billing_events", "billing_webhook_secret"])
        await expect(
          as(db, user, () => db.query(`select * from public.${table}`)),
        ).rejects.toThrow(/permission denied/);
  });
});

describe("the webhook's write path", () => {
  it("refuses callers without the secret, and signed-in users altogether", async () => {
    const { db, anaWs } = await seeded();
    const forged = sqlBillingWriter(db, "wrong-secret-0123456789abcdefghijklmnop");
    await expect(
      forged.applyEvent(
        "evt_1",
        "customer.subscription.created",
        state({ workspace_id: anaWs.id }),
      ),
    ).rejects.toMatchObject({ kind: "forbidden" });
    await expect(
      sqlBillingWriter(db, "short").applyEvent("evt_1", "customer.subscription.created", null),
    ).rejects.toMatchObject({ kind: "forbidden" });
    await expect(
      as(db, ANA, () =>
        db.query(
          "select public.apply_billing_event($1, 'evt_1', 'invoice.payment_failed', null)",
          [SECRET],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    expect(await events(db)).toEqual([]);
  });

  it("refuses everything until the owner has stored a secret", async () => {
    const db = await createTestDatabase();
    await expect(
      sqlBillingWriter(db, SECRET).applyEvent("evt_1", "invoice.payment_failed", null),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("applies an event once; a redelivery changes nothing", async () => {
    const { db, ana, anaWs, writer } = await seeded();
    const created = state({ workspace_id: anaWs.id, status: "incomplete" });
    expect(await writer.applyEvent("evt_1", "checkout.session.completed", created)).toBe(
      "applied",
    );
    expect(
      await writer.applyEvent(
        "evt_2",
        "customer.subscription.updated",
        state({ workspace_id: anaWs.id }),
      ),
    ).toBe("applied");
    // evt_1 again, with its old state: refused as a duplicate, state unchanged.
    expect(await writer.applyEvent("evt_1", "checkout.session.completed", created)).toBe(
      "duplicate",
    );
    expect((await ana.subscription(anaWs.id))?.status).toBe("active");
    expect(await events(db)).toEqual([
      { id: "evt_1", outcome: "applied" },
      { id: "evt_2", outcome: "applied" },
    ]);
  });

  it("records events with nothing to write as ignored", async () => {
    const { db, writer } = await seeded();
    expect(await writer.applyEvent("evt_1", "checkout.session.completed", null)).toBe(
      "ignored",
    );
    expect(await writer.applyEvent("evt_1", "checkout.session.completed", null)).toBe(
      "duplicate",
    );
    expect(await events(db)).toEqual([{ id: "evt_1", outcome: "ignored" }]);
  });

  it("finds the workspace by subscription or customer when the event names none", async () => {
    const { ana, anaWs, writer } = await seeded();
    await writer.applyEvent(
      "evt_1",
      "checkout.session.completed",
      state({ workspace_id: anaWs.id }),
    );
    expect(
      await writer.applyEvent(
        "evt_2",
        "customer.subscription.updated",
        state({ cancel_at_period_end: true }),
      ),
    ).toBe("applied");
    expect((await ana.subscription(anaWs.id))?.cancelAtPeriodEnd).toBe(true);
    // A new subscription for the same customer (resubscribing) still lands here.
    expect(
      await writer.applyEvent(
        "evt_3",
        "customer.subscription.created",
        state({ subscription_id: "sub_Ana2", interval: "year" }),
      ),
    ).toBe("applied");
    expect((await ana.subscription(anaWs.id))?.interval).toBe("year");
  });

  it("records a subscription it can't place as unlinked and writes nothing", async () => {
    const { db, writer } = await seeded();
    expect(
      await writer.applyEvent(
        "evt_1",
        "customer.subscription.created",
        state({ customer_id: "cus_Nobody" }),
      ),
    ).toBe("unlinked");
    expect(
      await writer.applyEvent(
        "evt_2",
        "customer.subscription.created",
        state({ workspace_id: "00000000-0000-4000-8000-000000000999" }),
      ),
    ).toBe("unlinked");
    expect((await db.query("select * from public.workspace_subscriptions")).rows).toEqual([]);
  });

  it("never lets an ended older subscription overwrite a live newer one", async () => {
    const { ana, anaWs, writer } = await seeded();
    await writer.applyEvent(
      "evt_1",
      "customer.subscription.created",
      state({ workspace_id: anaWs.id, subscription_id: "sub_New" }),
    );
    expect(
      await writer.applyEvent(
        "evt_2",
        "customer.subscription.deleted",
        state({ workspace_id: anaWs.id, subscription_id: "sub_Old", status: "canceled" }),
      ),
    ).toBe("stale");
    expect(await ana.subscription(anaWs.id)).toMatchObject({ status: "active" });
    // The current subscription ending is applied normally.
    expect(
      await writer.applyEvent(
        "evt_3",
        "customer.subscription.deleted",
        state({ workspace_id: anaWs.id, subscription_id: "sub_New", status: "canceled" }),
      ),
    ).toBe("applied");
    expect(await ana.subscription(anaWs.id)).toMatchObject({ status: "canceled" });
  });

  it("won't move a customer or subscription from one workspace to another", async () => {
    const { ana, ben, anaWs, benWs, writer } = await seeded();
    await writer.applyEvent(
      "evt_1",
      "checkout.session.completed",
      state({ workspace_id: anaWs.id }),
    );
    expect(
      await writer.applyEvent(
        "evt_2",
        "checkout.session.completed",
        state({ workspace_id: benWs.id }),
      ),
    ).toBe("conflict");
    expect(await ben.subscription(benWs.id)).toBeNull();
    expect((await ana.subscription(anaWs.id))?.stripeCustomerId).toBe("cus_Ana1");
  });

  it("validates the event and state before recording anything", async () => {
    const { db, anaWs, writer } = await seeded();
    const bad: Array<[string, string, SubscriptionState | null]> = [
      ["not-an-event", "invoice.payment_failed", null],
      ["evt_1", "charge.refunded", null],
      ["evt_1", "customer.subscription.updated", state({ status: "bogus" as never })],
      ["evt_1", "customer.subscription.updated", state({ customer_id: "acct_1" })],
      ["evt_1", "customer.subscription.updated", state({ subscription_id: "sub_' or 1=1" })],
      ["evt_1", "customer.subscription.updated", state({ workspace_id: "not-a-uuid" })],
      ["evt_1", "customer.subscription.updated", state({ plan: "enterprise" as never })],
      ["evt_1", "customer.subscription.updated", state({ interval: "week" as never })],
      ["evt_1", "customer.subscription.updated", state({ current_period_end: "soon" })],
    ];
    for (const [id, type, value] of bad)
      await expect(
        writer.applyEvent(
          id,
          type as never,
          value && { ...value, workspace_id: value.workspace_id ?? anaWs.id },
        ),
      ).rejects.toMatchObject({ kind: "invalid" });
    expect(await events(db)).toEqual([]);
    expect((await db.query("select * from public.workspace_subscriptions")).rows).toEqual([]);
  });

  it("accepts a subscription without an interval or period end", async () => {
    const { ana, anaWs, writer } = await seeded();
    expect(
      await writer.applyEvent(
        "evt_1",
        "customer.subscription.created",
        state({
          workspace_id: anaWs.id,
          plan: "custom",
          interval: null,
          current_period_end: null,
        }),
      ),
    ).toBe("applied");
    expect(await ana.subscription(anaWs.id)).toMatchObject({
      plan: "custom",
      interval: null,
      currentPeriodEnd: null,
    });
  });
});

describe("when a payment first failed (grace period)", () => {
  const failedAt = async (db: Awaited<ReturnType<typeof seeded>>["db"]) =>
    (
      await db.query<{ payment_failed_at: Date | null }>(
        "select payment_failed_at from public.workspace_subscriptions",
      )
    ).rows[0]?.payment_failed_at ?? null;

  it("records the first failure, keeps it through retries, and clears it once paid", async () => {
    const { db, ana, anaWs, writer } = await seeded();
    await writer.applyEvent(
      "evt_g1",
      "checkout.session.completed",
      state({ workspace_id: anaWs.id }),
    );
    expect(await failedAt(db)).toBeNull();

    await writer.applyEvent("evt_g2", "invoice.payment_failed", state({ status: "past_due" }));
    const first = await failedAt(db);
    expect(first).toBeInstanceOf(Date);
    expect((await ana.subscription(anaWs.id))?.paymentFailedAt).toBe(first!.toISOString());

    // A retry that fails again, or a subscription update, doesn't move the start.
    await db.query(
      "update public.workspace_subscriptions set payment_failed_at = payment_failed_at - interval '2 days'",
    );
    const moved = await failedAt(db);
    await writer.applyEvent("evt_g3", "invoice.payment_failed", state({ status: "past_due" }));
    await writer.applyEvent(
      "evt_g4",
      "customer.subscription.updated",
      state({ status: "unpaid" }),
    );
    expect(await failedAt(db)).toEqual(moved);

    await writer.applyEvent(
      "evt_g5",
      "customer.subscription.updated",
      state({ status: "active" }),
    );
    expect(await failedAt(db)).toBeNull();
  });

  it("starts the grace when past_due arrives after a failure that was read while still active", async () => {
    const { db, ana, anaWs, writer } = await seeded();
    await writer.applyEvent(
      "evt_h1",
      "invoice.payment_failed",
      state({ workspace_id: anaWs.id }),
    );
    // Still active when read: entitled, so no grace is running yet.
    expect(await failedAt(db)).toBeNull();
    await writer.applyEvent(
      "evt_h2",
      "customer.subscription.updated",
      state({ status: "past_due" }),
    );
    const started = await failedAt(db);
    expect(started).toBeInstanceOf(Date);
    const read = await ana.subscription(anaWs.id);
    expect(read?.paymentFailedAt).toBe(started!.toISOString());
    expect(graceEndsAt(read!)?.getTime()).toBe(started!.getTime() + GRACE_DAYS * 86_400_000);

    // The failure event delivered late, or a later move to unpaid, keeps the start.
    await db.query(
      "update public.workspace_subscriptions set payment_failed_at = payment_failed_at - interval '1 day'",
    );
    const moved = await failedAt(db);
    await writer.applyEvent("evt_h3", "invoice.payment_failed", state({ status: "past_due" }));
    await writer.applyEvent(
      "evt_h4",
      "customer.subscription.updated",
      state({ status: "unpaid" }),
    );
    expect(await failedAt(db)).toEqual(moved);
  });

  it("starts the grace on the first row when it already reads past_due", async () => {
    const { db, anaWs, writer } = await seeded();
    await writer.applyEvent(
      "evt_i1",
      "customer.subscription.updated",
      state({ workspace_id: anaWs.id, status: "past_due" }),
    );
    expect(await failedAt(db)).toBeInstanceOf(Date);
  });

  it("starts nothing for statuses that aren't a failed payment", async () => {
    const { db, anaWs, writer } = await seeded();
    await writer.applyEvent(
      "evt_j1",
      "customer.subscription.updated",
      state({ workspace_id: anaWs.id, status: "paused" }),
    );
    await writer.applyEvent(
      "evt_j2",
      "customer.subscription.deleted",
      state({ status: "canceled" }),
    );
    expect(await failedAt(db)).toBeNull();
  });
});

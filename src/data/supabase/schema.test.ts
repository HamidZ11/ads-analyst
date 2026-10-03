import type { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { ecommerceCsv, leadCsv } from "@/data/import/__fixtures__/meta-exports";
import { inspectHeaders, parseCsv, proposeMapping } from "@/data/import";
import { planImport } from "@/features/import/service";
import { addUser, as, createTestDatabase, sqlGateway } from "./test-database";

/**
 * Row level security and tenant constraints, tested directly in SQL as the
 * `authenticated` and `anon` roles, the way PostgREST runs queries.
 */

const ANA = "00000000-0000-4000-8000-00000000000a";
const BEN = "00000000-0000-4000-8000-00000000000b";
const TABLES = [
  "clients",
  "ad_accounts",
  "campaigns",
  "ad_sets",
  "creatives",
  "ads",
  "daily_metrics",
  "imports",
];

function payload(
  csv: string,
  name: string,
  type: "ecommerce" | "lead_generation" = "ecommerce",
) {
  const parsed = parseCsv(csv);
  if (!parsed.ok) throw new Error("bad fixture");
  const plan = planImport(
    {
      fileName: "export.csv",
      fileBytes: csv.length,
      csv,
      mapping: proposeMapping(inspectHeaders(parsed.table.headers), type).mapping,
      destination: {
        kind: "new",
        client: {
          name,
          type,
          currency: "GBP",
          timezone: "Europe/London",
          targetCpa: null,
          targetRoas: null,
        },
      },
    },
    { now: new Date("2026-10-03T10:00:00Z"), clients: [], accountIdFor: () => null },
  );
  if (!plan.ok) throw new Error(plan.message);
  return plan.payload;
}

async function seeded() {
  const db = await createTestDatabase();
  await addUser(db, ANA, "ana@agency.test");
  await addUser(db, BEN, "ben@other.test");
  const ana = sqlGateway(db, ANA);
  const ben = sqlGateway(db, BEN);
  const [anaWs] = await ana.ensureWorkspaces("Ana's workspace");
  const [benWs] = await ben.ensureWorkspaces("Ben's workspace");
  const written = await ana.importMetaCsv(
    anaWs.id,
    payload(ecommerceCsv(), "Bloom Botanicals"),
  );
  return { db, ana, ben, anaWs, benWs, clientId: written.clientId };
}

const count = (db: PGlite, user: string | null, table: string) =>
  as(
    db,
    user,
    async () =>
      (await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`)).rows[0]
        .n,
  );

describe("workspaces and membership", () => {
  it("creates one personal workspace on first sign-in and returns it on every later call", async () => {
    const db = await createTestDatabase();
    await addUser(db, ANA, "ana@agency.test");
    const ana = sqlGateway(db, ANA);
    const first = await ana.ensureWorkspaces("Ana's workspace");
    const second = await ana.ensureWorkspaces("Ignored name");
    expect(first).toHaveLength(1);
    expect(second.map((w) => w.id)).toEqual(first.map((w) => w.id));
    expect(first[0]).toMatchObject({ name: "Ana's workspace", role: "owner" });
    await expect(
      as(db, null, () => db.query("select * from public.ensure_default_workspace('x')")),
    ).rejects.toThrow();
  });

  it("lets membership, and only membership, grant access", async () => {
    const { db, anaWs } = await seeded();
    for (const table of TABLES) expect(await count(db, ANA, table), table).toBeGreaterThan(0);
    for (const table of TABLES) expect(await count(db, BEN, table), table).toBe(0);
    expect(await count(db, BEN, "workspaces")).toBe(1); // only Ben's own
    await db.query(
      "insert into public.workspace_members (workspace_id, user_id) values ($1, $2)",
      [anaWs.id, BEN],
    );
    expect(await count(db, BEN, "clients")).toBe(1);
    expect(await count(db, BEN, "workspaces")).toBe(2);
    await db.query(
      "delete from public.workspace_members where workspace_id = $1 and user_id = $2",
      [anaWs.id, BEN],
    );
    expect(await count(db, BEN, "daily_metrics")).toBe(0);
  });

  it("does not let users grant themselves membership or read anything anonymously", async () => {
    const { db, anaWs } = await seeded();
    await expect(
      as(db, BEN, () =>
        db.query(
          "insert into public.workspace_members (workspace_id, user_id) values ($1, $2)",
          [anaWs.id, BEN],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    for (const table of [...TABLES, "workspaces", "workspace_members"])
      await expect(count(db, null, table), table).rejects.toThrow(/permission denied/);
    await expect(
      as(db, null, () => db.query("select public.workspace_snapshot($1)", [anaWs.id])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("tenant isolation on writes", () => {
  it("blocks writes into another workspace and leaves its rows untouched", async () => {
    const { db, anaWs, clientId } = await seeded();
    await expect(
      as(db, BEN, () =>
        db.query(
          "insert into public.clients (workspace_id, name, type, currency, timezone) values ($1, 'Intruder', 'ecommerce', 'GBP', 'UTC')",
          [anaWs.id],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const updated = await as(db, BEN, () =>
      db.query("update public.clients set name = 'Renamed' where id = $1", [clientId]),
    );
    expect(updated.affectedRows).toBe(0);
    const deleted = await as(db, BEN, () =>
      db.query("delete from public.daily_metrics where client_id = $1", [clientId]),
    );
    expect(deleted.affectedRows).toBe(0);
    expect(await count(db, ANA, "daily_metrics")).toBe(70);
  });

  it("stops a row in one workspace pointing at another workspace's parent", async () => {
    const { db, benWs, clientId } = await seeded();
    const account = (
      await db.query<{ id: string }>("select id from public.ad_accounts where client_id = $1", [
        clientId,
      ])
    ).rows[0].id;
    await expect(
      as(db, BEN, () =>
        db.query(
          "insert into public.campaigns (workspace_id, client_id, ad_account_id, source_key, name, status) values ($1, $2, $3, 'k', 'x', 'active')",
          [benWs.id, clientId, account],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("keeps the import audit trail append-only", async () => {
    const { db } = await seeded();
    await expect(
      as(db, ANA, () => db.query("update public.imports set row_count = 0")),
    ).rejects.toThrow(/permission denied/);
    await expect(as(db, ANA, () => db.query("delete from public.imports"))).rejects.toThrow(
      /permission denied/,
    );
  });
});

describe("import transaction", () => {
  it("refuses a workspace the caller doesn't belong to", async () => {
    const { ben, anaWs } = await seeded();
    await expect(
      ben.importMetaCsv(anaWs.id, payload(leadCsv(), "Harbour", "lead_generation")),
    ).rejects.toMatchObject({ kind: "forbidden" });
  });

  it("rolls the whole import back when any part fails", async () => {
    const { db, ana, anaWs } = await seeded();
    const before = await Promise.all(TABLES.map((t) => count(db, ANA, t)));
    const broken = payload(leadCsv(), "Harbour", "lead_generation");
    broken.metrics.push({ ...broken.metrics[0], ad_key: "ad_does_not_exist" });
    await expect(ana.importMetaCsv(anaWs.id, broken)).rejects.toMatchObject({
      kind: "invalid",
    });
    const negative = payload(leadCsv(), "Harbour", "lead_generation");
    negative.metrics[5] = { ...negative.metrics[5], spend: -1 };
    await expect(ana.importMetaCsv(anaWs.id, negative)).rejects.toMatchObject({
      kind: "invalid",
    });
    expect(await Promise.all(TABLES.map((t) => count(db, ANA, t)))).toEqual(before);
  });

  it("upserts entities and metrics instead of duplicating them", async () => {
    const { db, ana, anaWs, clientId } = await seeded();
    const again = payload(ecommerceCsv(), "ignored");
    again.client = { mode: "existing", id: clientId };
    expect(await ana.importMetaCsv(anaWs.id, again)).toMatchObject({
      daysAdded: 0,
      daysReplaced: 70,
    });
    for (const [table, n] of [
      ["campaigns", 3],
      ["ad_sets", 4],
      ["ads", 5],
      ["creatives", 5],
      ["daily_metrics", 70],
      ["imports", 2],
    ] as const)
      expect(await count(db, ANA, table), table).toBe(n);
  });

  it("refuses a file for a different ad account than the client's", async () => {
    const { ana, anaWs, clientId } = await seeded();
    const other = payload(ecommerceCsv(), "ignored");
    other.client = { mode: "existing", id: clientId };
    other.account = { external_id: "999999", name: "Other account" };
    await expect(ana.importMetaCsv(anaWs.id, other)).rejects.toMatchObject({
      kind: "account_mismatch",
    });
  });
});

describe("workspace snapshot", () => {
  it("returns only the caller's workspace and resolves a foreign client to their own", async () => {
    const { ana, ben, anaWs, benWs, clientId } = await seeded();
    await expect(ben.snapshot(anaWs.id, clientId)).rejects.toMatchObject({ kind: "forbidden" });
    const own = await ben.snapshot(benWs.id, clientId);
    expect(own.client_id).toBeNull();
    expect([own.clients, own.campaigns, own.metrics, own.imports]).toEqual([[], [], [], []]);
    const anas = await ana.snapshot(anaWs.id, "00000000-0000-4000-8000-0000000000ff");
    expect(anas.client_id).toBe(clientId);
    expect(anas.metrics).toHaveLength(70);
    expect(anas.coverage).toEqual([
      {
        client_id: clientId,
        first_date: "2026-09-17",
        last_date: "2026-09-30",
        days: 14,
        rows: 70,
      },
    ]);
  });
});

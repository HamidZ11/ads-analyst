import type { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { ecommerceCsv, leadCsv } from "@/data/import/__fixtures__/meta-exports";
import { inspectHeaders, parseCsv, proposeMapping, type ImportPayload } from "@/data/import";
import { IMPORT_LIMIT_MESSAGE, importFailure, planImport } from "@/features/import/service";
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
    const intrude = () =>
      as(db, BEN, async () => {
        const inserted = await db
          .query(
            "insert into public.clients (workspace_id, name, type, currency, timezone) values ($1, 'Intruder', 'ecommerce', 'GBP', 'UTC')",
            [anaWs.id],
          )
          .then(
            () => "inserted",
            (error: Error) => error.message,
          );
        const updated = await db
          .query("update public.clients set name = 'Renamed' where id = $1", [clientId])
          .then(
            (r) => r.affectedRows,
            (error: Error) => error.message,
          );
        const deleted = await db
          .query("delete from public.daily_metrics where client_id = $1", [clientId])
          .then(
            (r) => r.affectedRows,
            (error: Error) => error.message,
          );
        return { inserted, updated, deleted };
      });
    // No write privilege at all (D-060).
    expect(await intrude()).toEqual({
      inserted: "permission denied for table clients",
      updated: "permission denied for table clients",
      deleted: "permission denied for table daily_metrics",
    });
    // Defence in depth: with the privileges restored, RLS still confines writes.
    await db.query(
      "grant insert, update, delete on public.clients, public.daily_metrics to authenticated",
    );
    expect(await intrude()).toEqual({
      inserted: expect.stringMatching(/row-level security/),
      updated: 0,
      deleted: 0,
    });
    expect(await count(db, ANA, "daily_metrics")).toBe(70);
    expect(await count(db, ANA, "clients")).toBe(1);
  });

  it("stops a row in one workspace pointing at another workspace's parent", async () => {
    const { db, benWs, clientId } = await seeded();
    const account = (
      await db.query<{ id: string }>("select id from public.ad_accounts where client_id = $1", [
        clientId,
      ])
    ).rows[0].id;
    // As the table owner (no RLS, every privilege), so only the composite
    // foreign key can refuse it. Users cannot write campaigns at all.
    await expect(
      db.query(
        "insert into public.campaigns (workspace_id, client_id, ad_account_id, source_key, name, status) values ($1, $2, $3, 'k', 'x', 'active')",
        [benWs.id, clientId, account],
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

  it("records imports only under the member who made them", async () => {
    const { db, ana, anaWs, clientId } = await seeded();
    const insert = (importedBy: string) =>
      as(db, ANA, () =>
        db.query(
          `insert into public.imports (workspace_id, client_id, file_name, file_bytes, row_count,
             date_start, date_end, currency, outcome_column, new_ad_days, updated_ad_days, imported_by)
           values ($1, $2, 'x.csv', 1, 1, '2026-09-01', '2026-09-01', 'GBP', 'Results', 0, 0, $3)`,
          [anaWs.id, clientId, importedBy],
        ),
      );
    // A payload naming someone else is ignored: the function records the caller.
    const forged = { ...payload(leadCsv(), "Harbour", "lead_generation") } as Record<
      string,
      unknown
    >;
    forged.import = { ...(forged.import as object), imported_by: BEN, user_id: BEN };
    await ana.importMetaCsv(
      anaWs.id,
      forged as unknown as Parameters<typeof ana.importMetaCsv>[1],
    );
    for (const id of [ANA, BEN]) await expect(insert(id)).rejects.toThrow(/permission denied/);
    // Defence in depth: with the insert privilege restored, the policy still
    // refuses a record naming another member.
    await db.query("grant insert on public.imports to authenticated");
    await expect(insert(BEN)).rejects.toThrow(/row-level security/);
    await insert(ANA);
    const authors = await db.query<{ imported_by: string }>(
      "select distinct imported_by from public.imports",
    );
    expect(authors.rows).toEqual([{ imported_by: ANA }]);
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

describe("rate limits", () => {
  it("allows 30 imports an hour per user, counted separately for each user", async () => {
    const { db, ana, ben } = await seeded();
    for (let i = 0; i < 30; i += 1) expect(await ana.consumeRateLimit("import")).toBe(true);
    expect(await ana.consumeRateLimit("import")).toBe(false);
    expect(await ana.consumeRateLimit("import")).toBe(false);
    expect(await ben.consumeRateLimit("import")).toBe(true);
    // The counter stops one past the limit however often it is called.
    const hits = await db.query<{ hits: number }>(
      "select hits from public.rate_limits where user_id = $1 and action = 'import'",
      [ANA],
    );
    expect(hits.rows).toEqual([{ hits: 31 }]);
  });

  it("starts a new window once the hour has passed", async () => {
    const { db, ana } = await seeded();
    for (let i = 0; i < 31; i += 1) await ana.consumeRateLimit("import");
    await db.query(
      "update public.rate_limits set window_started_at = now() - interval '61 minutes' where user_id = $1",
      [ANA],
    );
    expect(await ana.consumeRateLimit("import")).toBe(true);
  });

  it("refuses unknown actions, anonymous callers and direct access to the counters", async () => {
    const { db, ana } = await seeded();
    await expect(ana.consumeRateLimit("anything" as "import")).rejects.toMatchObject({
      kind: "invalid",
    });
    await expect(
      as(db, null, () => db.query("select public.consume_rate_limit('import')")),
    ).rejects.toThrow(/permission denied/);
    for (const sql of [
      "select * from public.rate_limits",
      "delete from public.rate_limits",
      `insert into public.rate_limits (user_id, action, window_started_at, hits) values ('${ANA}', 'import', now(), 0)`,
    ])
      await expect(
        as(db, ANA, () => db.query(sql)),
        sql,
      ).rejects.toThrow(/permission denied/);
  });
});

describe("controlled write boundary", () => {
  const ALL_TABLES = [...TABLES, "workspaces", "workspace_members"];
  const hits = async (db: PGlite, user: string, action: string) =>
    (
      await db.query<{ hits: number }>(
        "select hits from public.rate_limits where user_id = $1 and action = $2",
        [user, action],
      )
    ).rows[0]?.hits ?? 0;

  it("refuses every direct write to application tables, even in the caller's own workspace", async () => {
    // Before D-060 the owner could insert, update and delete here directly.
    const { db } = await seeded();
    for (const table of ALL_TABLES) {
      const column = table === "workspaces" ? "id" : "workspace_id";
      for (const sql of [
        `insert into public.${table} default values`,
        `update public.${table} set ${column} = ${column}`,
        `delete from public.${table}`,
      ])
        await expect(
          as(db, ANA, () => db.query(sql)),
          sql,
        ).rejects.toThrow(/permission denied/);
    }
    // Memberships are read only by the security definer functions.
    await expect(count(db, ANA, "workspace_members")).rejects.toThrow(/permission denied/);
    for (const table of TABLES) expect(await count(db, ANA, table), table).toBeGreaterThan(0);
  });

  it("still lets members write through the functions", async () => {
    const { ana, anaWs, clientId } = await seeded();
    expect(await ana.updateTargets(clientId, 25, null)).toBe(true);
    const harbour = await ana.importMetaCsv(
      anaWs.id,
      payload(leadCsv(), "Harbour", "lead_generation"),
    );
    const snapshot = await ana.snapshot(anaWs.id, clientId);
    expect(snapshot.clients.map((c) => [c.id, Number(c.target_cpa)])).toEqual([
      [clientId, 25],
      [harbour.clientId, 0],
    ]);
    expect((await ana.snapshot(anaWs.id, harbour.clientId)).metrics.length).toBeGreaterThan(0);
  });

  it("keeps every write function inside the caller's own workspaces", async () => {
    const { db, ben, benWs, anaWs, clientId } = await seeded();
    const before = await Promise.all(TABLES.map((t) => count(db, ANA, t)));
    const intoAnas = payload(leadCsv(), "Harbour", "lead_generation");
    await expect(ben.importMetaCsv(anaWs.id, intoAnas)).rejects.toMatchObject({
      kind: "forbidden",
    });
    const anasClient = payload(ecommerceCsv(), "ignored");
    anasClient.client = { mode: "existing", id: clientId };
    await expect(ben.importMetaCsv(benWs.id, anasClient)).rejects.toMatchObject({
      kind: "not_found",
    });
    expect(await ben.updateTargets(clientId, 1, null)).toBe(false);
    expect(await Promise.all(TABLES.map((t) => count(db, ANA, t)))).toEqual(before);
    const target = await db.query<{ target_cpa: string | null }>(
      "select target_cpa from public.clients where id = $1",
      [clientId],
    );
    expect(target.rows).toEqual([{ target_cpa: null }]);
  });

  it("rejects forged workspace and client IDs", async () => {
    const { db, ana, anaWs } = await seeded();
    const before = await Promise.all(TABLES.map((t) => count(db, ANA, t)));
    const forged = "00000000-0000-4000-8000-0000000000ff";
    await expect(
      ana.importMetaCsv(forged, payload(leadCsv(), "Harbour", "lead_generation")),
    ).rejects.toMatchObject({ kind: "forbidden" });
    const intoForgedClient = payload(leadCsv(), "Harbour", "lead_generation");
    intoForgedClient.client = { mode: "existing", id: forged };
    await expect(ana.importMetaCsv(anaWs.id, intoForgedClient)).rejects.toMatchObject({
      kind: "not_found",
    });
    expect(await ana.updateTargets(forged, 10, null)).toBe(false);
    expect(await Promise.all(TABLES.map((t) => count(db, ANA, t)))).toEqual(before);
  });

  it("validates import payloads in the database before writing anything", async () => {
    const { db, ana, anaWs, clientId } = await seeded();
    const before = await Promise.all(TABLES.map((t) => count(db, ANA, t)));
    const base = () => payload(leadCsv(), "Harbour", "lead_generation");
    const cases: Array<[string, (p: ImportPayload) => unknown]> = [
      [
        "more than 100,000 metric rows",
        (p) => (p.metrics = Array.from({ length: 100_001 }, () => p.metrics[0])),
      ],
      ["no metric rows", (p) => (p.metrics = [])],
      ["a list that is not a list", (p) => Object.assign(p, { campaigns: "x" })],
      ["an over-long name", (p) => (p.campaigns[0].name = "x".repeat(301))],
      ["an empty source key", (p) => (p.ads[0].key = "")],
      ["a metric that is not a number", (p) => Object.assign(p.metrics[0], { spend: "NaN" })],
      ["a malformed date", (p) => Object.assign(p.metrics[0], { date: "01/09/2026" })],
      ["an unknown client mode", (p) => Object.assign(p.client, { mode: "other" })],
      ["an unknown timezone", (p) => Object.assign(p.client, { timezone: "Mars/Olympus" })],
      ["a CPA target out of range", (p) => Object.assign(p.client, { target_cpa: 2_000_000 })],
      ["a zero ROAS target", (p) => Object.assign(p.client, { target_roas: 0 })],
      ["a file over 10 MB", (p) => (p.import.file_bytes = 11 * 1024 * 1024)],
      ["a client ID that is not a UUID", (p) => (p.client = { mode: "existing", id: "x" })],
    ];
    for (const [label, mutate] of cases) {
      const bad = base();
      mutate(bad);
      await expect(ana.importMetaCsv(anaWs.id, bad), label).rejects.toMatchObject({
        kind: "invalid",
      });
    }
    await expect(
      ana.importMetaCsv(anaWs.id, [] as unknown as ImportPayload),
    ).rejects.toMatchObject({ kind: "invalid" });
    for (const [cpa, roas] of [
      [0, null],
      [-5, null],
      [1_000_001, null],
      [null, 1_001],
    ])
      await expect(ana.updateTargets(clientId, cpa, roas)).rejects.toMatchObject({
        kind: "invalid",
      });
    expect(await Promise.all(TABLES.map((t) => count(db, ANA, t)))).toEqual(before);
    expect(await hits(db, ANA, "import_write")).toBe(1); // only the seeded import
  });

  it("accepts what the importer accepts, including future-dated rows", async () => {
    const { ana, anaWs } = await seeded();
    const future = payload(leadCsv(), "Harbour", "lead_generation");
    future.metrics[0] = { ...future.metrics[0], date: "2099-01-01" };
    await expect(ana.importMetaCsv(anaWs.id, future)).resolves.toMatchObject({
      daysReplaced: 0,
    });
  });

  it("limits written imports per user in the database and does not count failed ones", async () => {
    const { db, ana, ben, anaWs, benWs } = await seeded();
    await db.query(
      "update public.rate_limits set hits = 29 where user_id = $1 and action = 'import_write'",
      [ANA],
    );
    const broken = payload(leadCsv(), "Harbour", "lead_generation");
    broken.metrics.push({ ...broken.metrics[0], ad_key: "ad_does_not_exist" });
    await expect(ana.importMetaCsv(anaWs.id, broken)).rejects.toMatchObject({
      kind: "invalid",
    });
    expect(await hits(db, ANA, "import_write")).toBe(29);
    await ana.importMetaCsv(anaWs.id, payload(leadCsv(), "Harbour", "lead_generation"));
    expect(await hits(db, ANA, "import_write")).toBe(30);
    const before = await Promise.all(TABLES.map((t) => count(db, ANA, t)));
    const refused = await ana
      .importMetaCsv(anaWs.id, payload(leadCsv(), "Kestrel", "lead_generation"))
      .catch((error: unknown) => error);
    expect(refused).toMatchObject({ kind: "rate_limited" });
    expect(importFailure(refused, "Kestrel")).toEqual({
      status: 429,
      message: IMPORT_LIMIT_MESSAGE,
    });
    expect(await Promise.all(TABLES.map((t) => count(db, ANA, t)))).toEqual(before);
    await expect(
      ben.importMetaCsv(benWs.id, payload(leadCsv(), "Kestrel", "lead_generation")),
    ).resolves.toMatchObject({ daysReplaced: 0 });
  });

  it("keeps anonymous callers away from every function", async () => {
    const { db, anaWs, clientId } = await seeded();
    for (const sql of [
      `select public.import_meta_csv('${anaWs.id}', '{}'::jsonb)`,
      `select public.update_client_targets('${clientId}', 1, null)`,
      "select public.consume_rate_limit('import_write')",
      "select * from public.ensure_default_workspace('x')",
      `select public.workspace_snapshot('${anaWs.id}')`,
    ])
      await expect(
        as(db, null, () => db.query(sql)),
        sql,
      ).rejects.toThrow(/permission denied/);
  });
});

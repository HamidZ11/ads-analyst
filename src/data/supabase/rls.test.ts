import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ecommerceCsv, leadCsv } from "@/data/import/__fixtures__/meta-exports";
import { newShareToken } from "@/features/report/share";
import {
  addUser,
  as,
  createTestDatabase,
  payload,
  setBillingSecret,
  sqlBillingWriter,
  sqlGateway,
  sqlSharedReportReader,
} from "./test-database";

/**
 * Cross-tenant isolation on every table in `public`, discovered from the
 * catalogue so a table added by a later migration fails here until it is
 * listed. Two users each own a workspace with real imported rows; each one
 * tries to read, insert, update and delete the other's rows, first with the
 * privileges the migrations grant, then with full write privileges restored,
 * to prove the policies confine writes on their own (defence in depth, as the
 * controlled write boundary migration promises).
 */

const ANA = "00000000-0000-4000-8000-00000000000a";
const BEN = "00000000-0000-4000-8000-00000000000b";

/** The column that ties each row to its tenant: a workspace, or a user for per-user tables. */
const TENANT_COLUMN: Record<string, string> = {
  workspaces: "id",
  workspace_members: "workspace_id",
  clients: "workspace_id",
  ad_accounts: "workspace_id",
  campaigns: "workspace_id",
  ad_sets: "workspace_id",
  creatives: "workspace_id",
  ads: "workspace_id",
  daily_metrics: "workspace_id",
  imports: "workspace_id",
  rate_limits: "user_id",
  workspace_subscriptions: "workspace_id",
  billing_events: "workspace_id",
  client_report_notes: "workspace_id",
  report_share_links: "workspace_id",
};
const TABLES = Object.keys(TENANT_COLUMN);

/** Tables with no tenant, with a column to try writing: nobody but the database owner may read or write them. */
const UNTENANTED: Record<string, string> = {
  billing_webhook_secret: "created_at",
  share_link_lookups: "window_started_at",
};

const BILLING_SECRET = "test-db-secret-0123456789abcdefghijklmnop";

type Tenant = { user: string; key: (table: string) => string };

async function twoTenants() {
  const db = await createTestDatabase();
  await addUser(db, ANA, "ana@agency.test");
  await addUser(db, BEN, "ben@other.test");
  const ana = sqlGateway(db, ANA);
  const ben = sqlGateway(db, BEN);
  const [anaWs] = await ana.ensureWorkspaces("Ana's workspace");
  const [benWs] = await ben.ensureWorkspaces("Ben's workspace");
  await ana.importMetaCsv(anaWs.id, payload(ecommerceCsv(), "Bloom Botanicals"));
  await ben.importMetaCsv(benWs.id, payload(leadCsv(), "Harbour Law", "lead_generation"));
  // A subscription and its event through the webhook's function, and a report
  // note through the member's function, for each workspace.
  await setBillingSecret(db, BILLING_SECRET);
  const webhook = sqlBillingWriter(db, BILLING_SECRET);
  for (const [gateway, ws, name] of [
    [ana, anaWs, "Ana"],
    [ben, benWs, "Ben"],
  ] as const) {
    await webhook.applyEvent(`evt_${name}1`, "customer.subscription.created", {
      workspace_id: ws.id,
      customer_id: `cus_${name}1`,
      subscription_id: `sub_${name}1`,
      plan: "agency",
      interval: "month",
      status: "active",
      current_period_end: "2026-11-30T12:00:00.000Z",
      cancel_at_period_end: false,
    });
    const { rows } = await db.query<{ id: string }>(
      "select id from public.clients where workspace_id = $1 limit 1",
      [ws.id],
    );
    await gateway.saveReportNote(
      rows[0].id,
      "2026-10-01",
      "2026-10-07",
      `${name}'s next steps.`,
    );
    // A share link, opened once, so the lookup counter has a row too.
    const token = newShareToken();
    await gateway.createShareLink({
      clientId: rows[0].id,
      token,
      preset: "7d",
      periodStart: "2026-09-24",
      periodEnd: "2026-09-30",
      days: 30,
    });
    await sqlSharedReportReader(db).lookup(token, `visitor-${name}`);
  }
  const tenant = (user: string, workspace: string): Tenant => ({
    user,
    key: (table) => (TENANT_COLUMN[table] === "user_id" ? user : workspace),
  });
  return { db, ana: tenant(ANA, anaWs.id), ben: tenant(BEN, benWs.id) };
}

/** As the database owner (RLS bypassed): a fingerprint of one tenant's rows in a table. */
async function fingerprint(db: PGlite, table: string, key: string) {
  const { rows } = await db.query<{ n: number; digest: string | null }>(
    `select count(*)::int as n, md5(string_agg(t::text, '|' order by t::text)) as digest
       from public.${table} t where ${TENANT_COLUMN[table]} = $1`,
    [key],
  );
  return rows[0];
}

async function fingerprints(db: PGlite, tenant: Tenant) {
  const prints = await Promise.all(
    TABLES.map(
      async (table) => [table, await fingerprint(db, table, tenant.key(table))] as const,
    ),
  );
  return Object.fromEntries(prints);
}

/** Runs one statement as `user` (null: anonymous): the rows it touched, or the error it raised. */
async function attempt(db: PGlite, user: string | null, sql: string, params: unknown[] = []) {
  try {
    const result = await as(db, user, () => db.query(sql, params));
    return { affected: result.affectedRows ?? result.rows.length, error: null };
  } catch (error) {
    return { affected: 0, error: (error as Error).message };
  }
}

/** One of `owner`'s rows as JSON, to replay as an insert by someone else. */
async function sampleRow(db: PGlite, table: string, owner: Tenant) {
  const { rows } = await db.query<{ row: unknown }>(
    `select to_jsonb(t) as row from public.${table} t where ${TENANT_COLUMN[table]} = $1 limit 1`,
    [owner.key(table)],
  );
  return rows[0]?.row;
}

/** Every cross-tenant write `intruder` can try against `victim` on `table`. */
async function crossTenantWrites(db: PGlite, table: string, intruder: Tenant, victim: Tenant) {
  const column = TENANT_COLUMN[table];
  return {
    insert: await attempt(
      db,
      intruder.user,
      `insert into public.${table} select * from jsonb_populate_record(null::public.${table}, $1)`,
      [await sampleRow(db, table, victim)],
    ),
    update: await attempt(
      db,
      intruder.user,
      `update public.${table} set ${column} = ${column} where ${column} = $1`,
      [victim.key(table)],
    ),
    delete: await attempt(
      db,
      intruder.user,
      `delete from public.${table} where ${column} = $1`,
      [victim.key(table)],
    ),
    // Moving the intruder's own rows into the victim's workspace.
    move: await attempt(
      db,
      intruder.user,
      `update public.${table} set ${column} = $1 where ${column} = $2`,
      [victim.key(table), intruder.key(table)],
    ),
  };
}

describe("row level security on every table", () => {
  let db: PGlite;
  let ana: Tenant;
  let ben: Tenant;
  beforeAll(async () => {
    ({ db, ana, ben } = await twoTenants());
    await sqlGateway(db, ANA).consumeRateLimit("import");
    await sqlGateway(db, BEN).consumeRateLimit("import");
  }, 30_000);

  it("knows every table in public, and every one has RLS on", async () => {
    const { rows } = await db.query<{ name: string; rls: boolean }>(
      `select c.relname as name, c.relrowsecurity as rls from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm', 'f')
        order by 1`,
    );
    expect(rows.map((r) => r.name)).toEqual([...TABLES, ...Object.keys(UNTENANTED)].sort());
    for (const row of rows) expect(row.rls, row.name).toBe(true);
  });

  it("gives both tenants rows in every table, so the checks below are not vacuous", async () => {
    for (const tenant of [ana, ben])
      for (const [table, print] of Object.entries(await fingerprints(db, tenant)))
        expect(print.n, `${table} for ${tenant.user}`).toBeGreaterThan(0);
  });

  it("never shows one tenant's rows to the other, or anything to anonymous callers", async () => {
    for (const [reader, owner] of [
      [ana, ben],
      [ben, ana],
    ])
      for (const table of TABLES) {
        const column = TENANT_COLUMN[table];
        const foreign = await attempt(
          db,
          reader.user,
          `select 1 from public.${table} where ${column} = $1`,
          [owner.key(table)],
        );
        expect(foreign.affected, `${reader.user} read ${table}`).toBe(0);
        const all = await attempt(
          db,
          reader.user,
          `select ${column} as k from public.${table}`,
        );
        if (all.error) expect(all.error, table).toMatch(/permission denied/);
        else {
          const { rows } = await as(db, reader.user, () =>
            db.query<{ k: string }>(`select ${column} as k from public.${table}`),
          );
          expect(new Set(rows.map((r) => r.k)), table).toEqual(new Set([reader.key(table)]));
        }
      }
    for (const table of TABLES) {
      const anon = await attempt(db, null, `select 1 from public.${table}`);
      expect(anon.error, `anon read ${table}`).toMatch(/permission denied/);
    }
  }, 30_000);

  it("keeps tables with no tenant closed to every user and to anonymous callers", async () => {
    for (const user of [ANA, BEN, null])
      for (const [table, column] of Object.entries(UNTENANTED))
        for (const sql of [
          `select 1 from public.${table}`,
          `insert into public.${table} default values`,
          `update public.${table} set ${column} = now()`,
          `delete from public.${table}`,
        ]) {
          const result = await attempt(db, user, sql);
          expect(result.error, `${user} ${sql}`).toMatch(/permission denied/);
        }
  });

  it("refuses every direct write into the other tenant, with the privileges the migrations grant", async () => {
    const before = [await fingerprints(db, ana), await fingerprints(db, ben)];
    for (const [intruder, victim] of [
      [ben, ana],
      [ana, ben],
    ])
      for (const table of TABLES) {
        const writes = await crossTenantWrites(db, table, intruder, victim);
        for (const [kind, result] of Object.entries(writes)) {
          expect(result.affected, `${kind} ${table}`).toBe(0);
          expect(result.error, `${kind} ${table}`).toMatch(/permission denied/);
        }
      }
    expect([await fingerprints(db, ana), await fingerprints(db, ben)]).toEqual(before);
  }, 30_000);
});

describe("row level security without the grant boundary", () => {
  it("still confines every write to the caller's tenant if write privileges were restored", async () => {
    const { db, ana, ben } = await twoTenants();
    await sqlGateway(db, ANA).consumeRateLimit("import");
    await sqlGateway(db, BEN).consumeRateLimit("import");
    await db.exec(
      `grant select, insert, update, delete on all tables in schema public to authenticated`,
    );
    const before = [await fingerprints(db, ana), await fingerprints(db, ben)];
    for (const [intruder, victim] of [
      [ben, ana],
      [ana, ben],
    ])
      for (const table of TABLES) {
        const writes = await crossTenantWrites(db, table, intruder, victim);
        // Inserting a row into the victim's workspace breaks a policy check.
        expect(writes.insert.error, `insert ${table}`).toMatch(/row-level security/);
        // Their rows are invisible to update and delete, so nothing matches.
        expect(writes.update, `update ${table}`).toEqual({ affected: 0, error: null });
        expect(writes.delete, `delete ${table}`).toEqual({ affected: 0, error: null });
        // Own rows can't be moved across: a policy check, a foreign key, or no
        // update policy at all (nothing matches).
        expect(writes.move.affected, `move ${table}`).toBe(0);
        if (writes.move.error)
          expect(writes.move.error, `move ${table}`).toMatch(/row-level security|foreign key/);
      }
    for (const table of Object.keys(UNTENANTED)) {
      const read = await attempt(db, ANA, `select 1 from public.${table}`);
      expect(read, `read ${table}`).toEqual({ affected: 0, error: null });
      const wipe = await attempt(db, ANA, `delete from public.${table}`);
      expect(wipe, `delete ${table}`).toEqual({ affected: 0, error: null });
    }
    expect([await fingerprints(db, ana), await fingerprints(db, ben)]).toEqual(before);
  }, 30_000);
});

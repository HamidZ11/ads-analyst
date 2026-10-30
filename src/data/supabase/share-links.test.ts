import { describe, expect, it } from "vitest";
import { ecommerceCsv, leadCsv } from "@/data/import/__fixtures__/meta-exports";
import { comparisonLabel, type PeriodPair } from "@/domain/periods";
import { buildClientReport } from "@/features/report/report-model";
import { buildSharedReport, newShareToken } from "@/features/report/share";
import { buildContext } from "@/features/workspace/context";
import type { NewShareLink, SharedReportPayload } from "./share";
import { snapshotRepository } from "./snapshot";
import {
  addUser,
  as,
  createTestDatabase,
  payload,
  sqlGateway,
  sqlSharedReportReader,
} from "./test-database";

/**
 * Read-only share links (D-NEW-share-1) against the real migrations in
 * PGlite, as the authenticated and anon roles: the token is stored only as a
 * hash, a link opens one client's report for one period and nothing else, it
 * expires and can be revoked, and anonymous callers reach nothing but the
 * share function.
 */

const ANA = "00000000-0000-4000-8000-00000000000a";
const BEN = "00000000-0000-4000-8000-00000000000b";
const CAL = "00000000-0000-4000-8000-00000000000c";
// The fixtures hold 2026-09-17 … 2026-09-30, so a week ending on the 27th
// compares 21–27 with 14–20 and leaves 28–30 outside the link.
const START = "2026-09-21";
const END = "2026-09-27";
const SPAN_START = "2026-09-14";
const VISITOR = "203.0.113.7";

async function seeded() {
  const db = await createTestDatabase();
  await addUser(db, ANA, "ana@agency.test");
  await addUser(db, BEN, "ben@other.test");
  await addUser(db, CAL, "cal@agency.test");
  const ana = sqlGateway(db, ANA);
  const ben = sqlGateway(db, BEN);
  const cal = sqlGateway(db, CAL);
  const [anaWs] = await ana.ensureWorkspaces("Northwind Media");
  const [benWs] = await ben.ensureWorkspaces("Ben's workspace");
  const bloom = (await ana.importMetaCsv(anaWs.id, payload(ecommerceCsv(), "Bloom Botanicals")))
    .clientId;
  const fern = (
    await ana.importMetaCsv(anaWs.id, payload(leadCsv(), "Fern Dental", "lead_generation"))
  ).clientId;
  const other = (await ben.importMetaCsv(benWs.id, payload(ecommerceCsv(), "Other Shop")))
    .clientId;
  // Cal is an ordinary member of Ana's workspace (no invite flow exists yet).
  await db.query(
    "insert into public.workspace_members (workspace_id, user_id, role) values ($1, $2, 'member')",
    [anaWs.id, CAL],
  );
  const reader = sqlSharedReportReader(db);
  return { db, ana, ben, cal, anaWs, benWs, bloom, fern, other, reader };
}

const link = (clientId: string, overrides: Partial<NewShareLink> = {}): NewShareLink => ({
  clientId,
  token: newShareToken(),
  preset: "7d",
  periodStart: START,
  periodEnd: END,
  days: 30,
  ...overrides,
});

async function open(reader: ReturnType<typeof sqlSharedReportReader>, token: string) {
  const result = await reader.lookup(token, VISITOR);
  if (result.status !== "ok") throw new Error(`expected a report, got ${result.status}`);
  return result;
}

describe("creating a share link", () => {
  it("stores only the token's SHA-256, nowhere in plain text", async () => {
    const { db, ana, bloom } = await seeded();
    const created = link(bloom);
    const result = await ana.createShareLink(created);
    expect(result?.id).toMatch(/^[0-9a-f-]{36}$/);
    const { rows } = await db.query<{ matches: boolean; hex: string }>(
      `select token_hash = sha256(convert_to($1, 'UTF8')) as matches, encode(token_hash, 'hex') as hex
         from public.report_share_links where id = $2`,
      [created.token, result!.id],
    );
    expect(rows[0].matches).toBe(true);
    // No column of any row in any table holds the token, as text or bytes.
    const tables = await db.query<{ name: string }>(
      "select tablename as name from pg_tables where schemaname = 'public'",
    );
    for (const { name } of tables.rows) {
      const dump = await db.query<{ row: string }>(
        `select t::text as row from public.${name} t`,
      );
      for (const { row } of dump.rows) {
        expect(row, name).not.toContain(created.token);
        expect(row, name).not.toContain(Buffer.from(created.token).toString("hex"));
      }
    }
  });

  it("expires after 30 days by default, or the days chosen", async () => {
    const { db, ana, bloom } = await seeded();
    const month = await ana.createShareLink(link(bloom));
    const week = await ana.createShareLink(link(bloom, { days: 7 }));
    const { rows } = await db.query<{ id: string; days: number }>(
      "select id, extract(epoch from expires_at - created_at)::int / 86400 as days from public.report_share_links",
    );
    const days = Object.fromEntries(rows.map((r) => [r.id, r.days]));
    expect(days[month!.id]).toBe(30);
    expect(days[week!.id]).toBe(7);
  });

  it("is the owner's: members, other workspaces and anonymous callers cannot create one", async () => {
    const { db, ben, cal, bloom } = await seeded();
    expect(await cal.createShareLink(link(bloom))).toBeNull();
    expect(await ben.createShareLink(link(bloom))).toBeNull();
    await expect(
      as(db, null, () =>
        db.query("select public.create_report_share_link($1, $2, '7d', $3, $4, 30)", [
          bloom,
          newShareToken(),
          START,
          END,
        ]),
      ),
    ).rejects.toThrow(/permission denied/);
    const { rows } = await db.query("select 1 from public.report_share_links");
    expect(rows).toHaveLength(0);
  });

  it("refuses weak tokens, expiries outside 1–365 days and periods that don't match the preset", async () => {
    const { ana, bloom } = await seeded();
    for (const bad of [
      { token: "short" },
      { token: "a".repeat(42) },
      { token: `${"a".repeat(42)}=` },
      { days: 0 },
      { days: 366 },
      { preset: "7d" as const, periodStart: END },
      { preset: "today" as const },
    ])
      await expect(ana.createShareLink(link(bloom, bad)), JSON.stringify(bad)).rejects.toThrow(
        expect.objectContaining({ kind: "invalid" }),
      );
  });
});

describe("opening a share link", () => {
  it("builds the same report the app builds for that client and period", async () => {
    const { ana, anaWs, bloom, reader } = await seeded();
    await ana.saveReportNote(bloom, START, END, "Moving budget to the serum.");
    const created = link(bloom);
    await ana.createShareLink(created);
    const shared = buildSharedReport(
      await open(reader, created.token),
      new Date("2026-10-01T09:00:00Z"),
    );

    const repository = snapshotRepository(await ana.snapshot(anaWs.id, bloom));
    const context = buildContext({
      mode: "supabase",
      user: { id: ANA, email: "ana@agency.test" },
      workspace: { id: anaWs.id, name: anaWs.name },
      repository,
      requestedClientId: bloom,
      preset: "7d",
      canImport: true,
      now: new Date("2026-10-01T09:00:00Z"),
    });
    const periods: PeriodPair = {
      preset: "7d",
      current: { start: START, end: END },
      previous: { start: SPAN_START, end: "2026-09-20" },
    };
    const app = buildClientReport({
      ...context,
      client: context.client!,
      dataSource: context.dataSource!,
      periods,
      comparison: comparisonLabel(periods),
    });
    expect(shared?.model).toEqual(app);
    expect(shared?.model.agencyName).toBe("Northwind Media");
    expect(shared?.model.metrics.find((m) => m.key === "spend")?.current).toBeGreaterThan(0);
    expect(shared?.note).toBe("Moving budget to the serum.");
  });

  it("returns only that client's rows, only for the period and the one before it", async () => {
    const { db, ana, bloom, fern, reader } = await seeded();
    await ana.saveReportNote(bloom, "2026-09-24", "2026-09-30", "Another period's note.");
    await ana.saveReportNote(fern, START, END, "Another client's note.");
    const created = link(bloom);
    await ana.createShareLink(created);
    const report: SharedReportPayload = await open(reader, created.token);

    expect(report.client.id).toBe(bloom);
    expect(report.note).toBeNull();
    const dates = report.metrics.map((m) => String(m.date).slice(0, 10));
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((d) => d >= SPAN_START && d <= END)).toBe(true);
    // Days outside the link exist in the database, and stay there.
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.daily_metrics where client_id = $1 and date > $2",
      [bloom, END],
    );
    expect(rows[0].n).toBeGreaterThan(0);

    const ids = async (table: string) =>
      new Set(
        (
          await db.query<{ id: string }>(
            `select id from public.${table} where client_id = $1`,
            [bloom],
          )
        ).rows.map((r) => r.id),
      );
    for (const [table, list] of [
      ["campaigns", report.campaigns],
      ["ad_sets", report.ad_sets],
      ["ads", report.ads],
      ["creatives", report.creatives],
      ["ad_accounts", report.accounts],
    ] as const) {
      const own = await ids(table);
      expect(list.length, table).toBeGreaterThan(0);
      for (const row of list) expect(own.has(row.id), table).toBe(true);
    }
    const ads = await ids("ads");
    for (const m of report.metrics) expect(ads.has(m.ad_id)).toBe(true);
    // Nothing the report doesn't need: no imports, file names or account ids.
    expect(Object.keys(report).sort()).toEqual(
      [
        "accounts",
        "ad_sets",
        "ads",
        "campaigns",
        "client",
        "creatives",
        "expires_at",
        "metrics",
        "note",
        "period_end",
        "period_start",
        "preset",
        "status",
        "workspace",
      ].sort(),
    );
    expect(report.accounts.every((a) => a.external_id === null)).toBe(true);
  });

  it("keeps clients and workspaces apart: each token opens its own client only", async () => {
    const { ana, ben, bloom, fern, other, reader } = await seeded();
    const forBloom = link(bloom);
    const forFern = link(fern);
    const forOther = link(other);
    await ana.createShareLink(forBloom);
    await ana.createShareLink(forFern);
    await ben.createShareLink(forOther);
    const reports = [
      [forBloom, bloom, "Northwind Media"],
      [forFern, fern, "Northwind Media"],
      [forOther, other, "Ben's workspace"],
    ] as const;
    const adsBy = new Map<string, Set<string>>();
    for (const [created, client, workspace] of reports) {
      const report = await open(reader, created.token);
      expect(report.client.id).toBe(client);
      expect(report.workspace.name).toBe(workspace);
      adsBy.set(client, new Set(report.ads.map((a) => a.id)));
    }
    // No ad appears in two clients' reports.
    const all = [...adsBy.values()].flatMap((s) => [...s]);
    expect(new Set(all).size).toBe(all.length);

    // Lists stay inside the workspace.
    const anaWs = (await ana.ensureWorkspaces("x"))[0];
    expect((await ana.shareLinks(anaWs.id)).map((l) => l.clientId).sort()).toEqual(
      [bloom, fern].sort(),
    );
    expect(await ben.shareLinks(anaWs.id)).toEqual([]);
  });

  it("shows an expired link as expired, never its report", async () => {
    const { db, ana, bloom, reader } = await seeded();
    const created = link(bloom, { days: 1 });
    const { id } = (await ana.createShareLink(created))!;
    expect((await reader.lookup(created.token, VISITOR)).status).toBe("ok");
    await db.query(
      `update public.report_share_links
          set created_at = now() - interval '2 days', expires_at = now() - interval '1 second'
        where id = $1`,
      [id],
    );
    expect(await reader.lookup(created.token, VISITOR)).toEqual({ status: "expired" });
    const anaWs = (await ana.ensureWorkspaces("x"))[0];
    expect(await ana.shareLinks(anaWs.id)).toEqual([]);
  });

  it("revokes at once, by any member of the workspace and nobody else", async () => {
    const { ana, ben, cal, bloom, reader } = await seeded();
    const first = link(bloom);
    const second = link(bloom);
    const one = (await ana.createShareLink(first))!;
    const two = (await ana.createShareLink(second))!;
    expect(await ben.revokeShareLink(one.id)).toBe(false);
    expect((await reader.lookup(first.token, VISITOR)).status).toBe("ok");
    expect(await ana.revokeShareLink(one.id)).toBe(true);
    expect(await reader.lookup(first.token, VISITOR)).toEqual({ status: "expired" });
    expect(await cal.revokeShareLink(two.id)).toBe(true);
    expect(await reader.lookup(second.token, VISITOR)).toEqual({ status: "expired" });
    const anaWs = (await ana.ensureWorkspaces("x"))[0];
    expect(await ana.shareLinks(anaWs.id)).toEqual([]);
  });

  it("answers not found for an unknown token or anything that isn't one", async () => {
    const { ana, bloom, reader } = await seeded();
    await ana.createShareLink(link(bloom));
    for (const token of [newShareToken(), "", "abc", "' or 1=1 --", "a".repeat(200)])
      expect(await reader.lookup(token, VISITOR), token).toEqual({ status: "not_found" });
  });

  it("allows 60 lookups per visitor in 10 minutes, then refuses without reading", async () => {
    const { db, ana, bloom, reader } = await seeded();
    const created = link(bloom);
    await ana.createShareLink(created);
    for (let i = 0; i < 60; i++)
      expect((await reader.lookup(i % 2 ? created.token : "nope", VISITOR)).status).not.toBe(
        "rate_limited",
      );
    expect(await reader.lookup(created.token, VISITOR)).toEqual({ status: "rate_limited" });
    expect(await reader.lookup(created.token, VISITOR)).toEqual({ status: "rate_limited" });
    // Another visitor has their own allowance.
    expect((await reader.lookup(created.token, "198.51.100.4")).status).toBe("ok");
    // The counter stops one past the limit, and only a hash of the visitor is kept.
    const { rows } = await db.query<{ hits: number; raw: boolean }>(
      "select hits, position(convert_to($1, 'UTF8') in visitor_hash) > 0 as raw from public.share_link_lookups order by hits desc",
      [VISITOR],
    );
    expect(rows[0]).toEqual({ hits: 61, raw: false });
    // A new window starts afresh.
    await db.query(
      "update public.share_link_lookups set window_started_at = now() - interval '11 minutes'",
    );
    expect((await reader.lookup(created.token, VISITOR)).status).toBe("ok");
  });
});

describe("what anonymous and signed-in callers can reach directly", () => {
  it("gives anon no table at all, and members no token hash", async () => {
    const { db, ana, bloom } = await seeded();
    await ana.createShareLink(link(bloom));
    for (const sql of [
      "select * from public.report_share_links",
      "select 1 from public.share_link_lookups",
      "insert into public.share_link_lookups default values",
      "delete from public.report_share_links",
    ])
      await expect(
        as(db, null, () => db.query(sql)),
        sql,
      ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, ANA, () => db.query("select token_hash from public.report_share_links")),
    ).rejects.toThrow(/permission denied/);
    await expect(
      as(db, ANA, () => db.query("select 1 from public.share_link_lookups")),
    ).rejects.toThrow(/permission denied/);
  });

  it("lets anon execute the share function and nothing else of this feature", async () => {
    const { db } = await seeded();
    const { rows } = await db.query<{ fn: string; anon: boolean; authenticated: boolean }>(
      `select p.proname as fn,
              has_function_privilege('anon', p.oid, 'execute') as anon,
              has_function_privilege('authenticated', p.oid, 'execute') as authenticated
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('create_report_share_link', 'revoke_report_share_link', 'shared_client_report')
        order by 1`,
    );
    expect(rows).toEqual([
      { fn: "create_report_share_link", anon: false, authenticated: true },
      { fn: "revoke_report_share_link", anon: false, authenticated: true },
      { fn: "shared_client_report", anon: true, authenticated: false },
    ]);
    // Every function anon can execute in public: the share lookup and the
    // billing webhook's writer, which needs its secret (D-088).
    const anonFns = await db.query<{ fn: string }>(
      `select p.proname as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
        order by 1`,
    );
    expect(anonFns.rows.map((r) => r.fn)).toEqual([
      "apply_billing_event",
      "shared_client_report",
    ]);
  });
});

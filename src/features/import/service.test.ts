import { describe, expect, it } from "vitest";
import {
  DAYS_14,
  ECOM_ADS,
  ECOM_HEADERS,
  LEAD_ADS,
  ecommerceCsv,
  ecommerceRows,
  leadCsv,
  metricsFor,
  toCsv,
  type AdSpec,
} from "@/data/import/__fixtures__/meta-exports";
import { inspectHeaders, parseCsv, proposeMapping } from "@/data/import";
import type { WorkspaceGateway } from "@/data/supabase/gateway";
import { snapshotRepository } from "@/data/supabase/snapshot";
import { addUser, createTestDatabase, sqlGateway } from "@/data/supabase/test-database";
import { answerQuestion } from "@/domain/ask/answer";
import { runInsightEngine } from "@/domain/insights";
import { periodAnchor } from "@/domain/periods";
import type { ClientType } from "@/domain/types";
import {
  getCampaignRows,
  getClientPeriodSummary,
  getCreativeRows,
} from "@/features/analytics/queries";
import { collectAskData } from "@/features/ask/facts";
import { buildCreativeBoard } from "@/features/creatives/board-data";
import { collectInsightFacts } from "@/features/insights/facts";
import { buildContext } from "@/features/workspace/context";
import type { Workspace } from "@/features/workspace/server";
import {
  readImportRequest,
  readTargets,
  runImport,
  type ImportRequest,
  type NewClientInput,
} from "./service";

/**
 * End to end against real Postgres (PGlite) with the production migration:
 * the planner writes through public.import_meta_csv as a signed-in user, and
 * pages read back through public.workspace_snapshot. RLS applies throughout.
 */

const NOW = new Date("2026-10-03T10:00:00Z");
const ANA = "00000000-0000-4000-8000-00000000000a";
const BEN = "00000000-0000-4000-8000-00000000000b";

function mappingFor(csv: string, type: ClientType) {
  const parsed = parseCsv(csv);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return proposeMapping(inspectHeaders(parsed.table.headers), type).mapping;
}

function newClient(overrides: Partial<NewClientInput> = {}): NewClientInput {
  return {
    name: "Bloom Botanicals",
    currency: "GBP",
    type: "ecommerce",
    timezone: "Europe/London",
    targetCpa: 20,
    targetRoas: null,
    ...overrides,
  };
}

function request(
  csv: string,
  destination: ImportRequest["destination"],
  type: ClientType = "ecommerce",
): ImportRequest {
  return {
    fileName: "export.csv",
    fileBytes: csv.length,
    csv,
    mapping: mappingFor(csv, type),
    destination,
  };
}

/** Expected totals straight from the fixture generator, for day indexes [from, to). */
function expected(ads: readonly AdSpec[], from: number, to: number) {
  const t = { spend: 0, conversions: 0, revenue: 0, impressions: 0, clicks: 0 };
  for (let i = from; i < to; i += 1)
    for (const spec of ads) {
      const m = metricsFor(spec, i);
      t.spend += m.spend;
      t.conversions += m.conversions;
      t.revenue += m.revenue;
      t.impressions += m.impressions;
      t.clicks += m.clicks;
    }
  return t;
}

async function setup() {
  const db = await createTestDatabase();
  await addUser(db, ANA, "ana@agency.test");
  await addUser(db, BEN, "ben@other.test");
  const ana = sqlGateway(db, ANA);
  const ben = sqlGateway(db, BEN);
  const [anaWs] = await ana.ensureWorkspaces("Ana's workspace");
  const [benWs] = await ben.ensureWorkspaces("Ben's workspace");
  return { db, ana, ben, anaWs, benWs };
}

async function load(
  gateway: WorkspaceGateway,
  workspaceId: string,
  clientId: string | null = null,
) {
  return snapshotRepository(await gateway.snapshot(workspaceId, clientId));
}

async function importInto(gateway: WorkspaceGateway, workspaceId: string, req: ImportRequest) {
  const repository = await load(gateway, workspaceId);
  return runImport(
    req,
    {
      now: NOW,
      clients: repository.listClients(),
      accountIdFor: (id) => repository.listAdAccounts(id)[0]?.externalId || null,
    },
    (payload) => gateway.importMetaCsv(workspaceId, payload),
  );
}

async function workspaceFor(
  gateway: WorkspaceGateway,
  workspaceId: string,
  clientId: string,
): Promise<Workspace> {
  const snapshot = await gateway.snapshot(workspaceId, clientId);
  const context = buildContext({
    mode: "supabase",
    user: { id: ANA, email: "ana@agency.test" },
    workspace: snapshot.workspace!,
    repository: snapshotRepository(snapshot),
    requestedClientId: snapshot.client_id,
    preset: "7d",
    canImport: true,
    now: NOW,
  });
  return { ...context, client: context.client!, dataSource: context.dataSource! };
}

describe("import service against Postgres", () => {
  it("creates a client from a valid export and records the import", async () => {
    const { ana, anaWs } = await setup();
    const outcome = await importInto(
      ana,
      anaWs.id,
      request(ecommerceCsv(), { kind: "new", client: newClient() }),
    );
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.result).toMatchObject({
      clientName: "Bloom Botanicals",
      currency: "GBP",
      firstDate: "2026-09-17",
      lastDate: "2026-09-30",
      campaigns: 3,
      ads: 5,
      daysAdded: 70,
      daysReplaced: 0,
    });
    expect(outcome.result.spend).toBeCloseTo(expected(ECOM_ADS, 0, 14).spend, 6);
    const snapshot = await ana.snapshot(anaWs.id, null);
    expect(snapshot.clients).toHaveLength(1);
    expect(snapshot.clients[0]).toMatchObject({
      name: "Bloom Botanicals",
      target_cpa: 20,
      target_roas: null,
      revenue_tracked: true,
      primary_conversion_column: "Purchases",
    });
    expect(snapshot.imports[0]).toMatchObject({
      file_name: "export.csv",
      row_count: 70,
      new_ad_days: 70,
      updated_ad_days: 0,
      account_external_id: "1234567890",
      outcome_column: "Purchases",
      revenue_column: "Purchases conversion value (GBP)",
      date_start: "2026-09-17",
      date_end: "2026-09-30",
    });
    expect(snapshot.accounts[0]).toMatchObject({
      external_id: "1234567890",
      name: "Bloom Botanicals",
    });
    expect(snapshot.campaigns.map((c) => c.name).sort()).toEqual(
      ECOM_ADS.map((a) => a.campaign)
        .filter((v, i, all) => all.indexOf(v) === i)
        .sort(),
    );
    const repository = snapshotRepository(snapshot);
    expect(repository.getDataSource(outcome.result.clientId).imports[0]).toMatchObject({
      rows: 70,
      daysAdded: 70,
      outcomeColumn: "Purchases",
    });
  });

  it("does not double-count a repeated import, and updates overlapping days while keeping the rest", async () => {
    const { ana, anaWs } = await setup();
    const first = await importInto(
      ana,
      anaWs.id,
      request(ecommerceCsv(), { kind: "new", client: newClient() }),
    );
    if (!first.ok) throw new Error(first.message);
    const again = await importInto(
      ana,
      anaWs.id,
      request(ecommerceCsv(), { kind: "existing", clientId: first.result.clientId }),
    );
    expect(again).toMatchObject({ ok: true, result: { daysAdded: 0, daysReplaced: 70 } });
    let repository = await load(ana, anaWs.id, first.result.clientId);
    const total = (r: typeof repository) =>
      r.queryMetrics({ clientId: first.result.clientId }).reduce((s, m) => s + m.spend, 0);
    expect(total(repository)).toBeCloseTo(expected(ECOM_ADS, 0, 14).spend, 4);
    expect(repository.getDataSource(first.result.clientId).imports).toHaveLength(2);

    // A later export covering 24 Sep – 7 Oct at double spend: 35 ad-days updated, 35 added.
    const later = Array.from({ length: 14 }, (_, i) =>
      new Date(Date.UTC(2026, 8, 24 + i)).toISOString().slice(0, 10),
    );
    const doubled = ECOM_ADS.map((a) => ({ ...a, spend: a.spend * 2 }));
    const overlap = await importInto(
      ana,
      anaWs.id,
      request(toCsv(ECOM_HEADERS, ecommerceRows(doubled, later)), {
        kind: "existing",
        clientId: first.result.clientId,
      }),
    );
    expect(overlap).toMatchObject({ ok: true, result: { daysAdded: 35, daysReplaced: 35 } });
    repository = await load(ana, anaWs.id, first.result.clientId);
    const spendOn = (date: string) =>
      repository
        .queryMetrics({ clientId: first.result.clientId })
        .filter((m) => m.date === date)
        .reduce((s, m) => s + m.spend, 0);
    const original = (dayIndex: number) =>
      ECOM_ADS.reduce((s, a) => s + metricsFor(a, dayIndex).spend, 0);
    const bumped = (dayIndex: number) =>
      doubled.reduce((s, a) => s + metricsFor(a, dayIndex).spend, 0);
    expect(spendOn("2026-09-17")).toBeCloseTo(original(0), 4); // kept
    expect(spendOn("2026-09-24")).toBeCloseTo(bumped(0), 4); // updated
    expect(spendOn("2026-10-07")).toBeCloseTo(bumped(13), 4); // added
    expect(repository.getCoverage(first.result.clientId)).toMatchObject({
      firstDate: "2026-09-17",
      lastDate: "2026-10-07",
      days: 21,
      rows: 105,
    });
  });

  it("refuses another workspace's client with the same answer as a missing one, and stores nothing", async () => {
    const { ana, anaWs, ben, benWs } = await setup();
    const bloom = await importInto(
      ana,
      anaWs.id,
      request(ecommerceCsv(), { kind: "new", client: newClient() }),
    );
    if (!bloom.ok) throw new Error(bloom.message);
    const intoAna = await importInto(
      ben,
      benWs.id,
      request(ecommerceCsv(), { kind: "existing", clientId: bloom.result.clientId }),
    );
    const intoNothing = await importInto(
      ben,
      benWs.id,
      request(ecommerceCsv(), {
        kind: "existing",
        clientId: "00000000-0000-4000-8000-0000000000ff",
      }),
    );
    expect(intoAna).toEqual({
      ok: false,
      status: 404,
      message: "That client isn't available. Choose another client.",
    });
    expect(intoNothing).toEqual(intoAna);
    // Even bypassing the planner, the database refuses: Ben is not a member of Ana's workspace.
    await expect(
      ben.importMetaCsv(anaWs.id, {
        client: { mode: "existing", id: bloom.result.clientId },
      } as never),
    ).rejects.toMatchObject({ kind: "forbidden" });
    expect((await ben.snapshot(benWs.id, bloom.result.clientId)).clients).toEqual([]);
    expect((await ana.snapshot(anaWs.id, null)).imports).toHaveLength(1);
  });

  it("enforces client names per workspace, ROAS needing value, currency and revenue rules", async () => {
    const { db, ana, anaWs, ben, benWs } = await setup();
    const first = await importInto(
      ana,
      anaWs.id,
      request(ecommerceCsv(), { kind: "new", client: newClient() }),
    );
    if (!first.ok) throw new Error(first.message);
    expect(
      await importInto(
        ana,
        anaWs.id,
        request(ecommerceCsv(), {
          kind: "new",
          client: newClient({ name: "bloom botanicals" }),
        }),
      ),
    ).toMatchObject({ ok: false, status: 409 });
    // A stale planner view still meets the database's unique index.
    const stale = await runImport(
      request(ecommerceCsv(), { kind: "new", client: newClient() }),
      { now: NOW, clients: [], accountIdFor: () => null },
      (payload) => ana.importMetaCsv(anaWs.id, payload),
    );
    expect(stale).toEqual({
      ok: false,
      status: 409,
      message: "A client called Bloom Botanicals already exists.",
    });
    // The same name is fine in another workspace.
    expect(
      await importInto(
        ben,
        benWs.id,
        request(ecommerceCsv(), { kind: "new", client: newClient() }),
      ),
    ).toMatchObject({ ok: true });
    expect(
      await importInto(
        ana,
        anaWs.id,
        request(
          leadCsv(),
          {
            kind: "new",
            client: newClient({ name: "Harbour", type: "lead_generation", targetRoas: 3 }),
          },
          "lead_generation",
        ),
      ),
    ).toMatchObject({ ok: false, status: 422 });
    const usd = await importInto(
      ana,
      anaWs.id,
      request(ecommerceCsv(), {
        kind: "new",
        client: newClient({ name: "Bloom US", currency: "USD" }),
      }),
    );
    expect(usd.ok ? [] : usd.issues?.map((i) => i.code)).toContain("currency_mismatch");
    const lead = await importInto(
      ana,
      anaWs.id,
      request(
        leadCsv(),
        { kind: "existing", clientId: first.result.clientId },
        "lead_generation",
      ),
    );
    expect(lead.ok ? [] : lead.issues?.map((i) => i.code)).toContain("missing_revenue");
    const counts = await db.query<{ n: number }>(
      "select count(*)::int as n from public.clients where workspace_id = $1",
      [anaWs.id],
    );
    expect(counts.rows[0].n).toBe(1);
  });

  it("re-validates untrusted request bodies", () => {
    expect(readImportRequest(null)).toBe("Invalid import payload.");
    expect(readImportRequest({ csv: "x", fileName: "a.csv", fileBytes: 1 })).toBe(
      "Choose a client for this import.",
    );
    const base = { csv: "x", fileName: "a.csv", fileBytes: 1, mapping: {} };
    expect(
      readImportRequest({
        ...base,
        destination: { kind: "new", client: { ...newClient(), currency: "AUD" } },
      }),
    ).toBe("Choose GBP, USD or EUR.");
    expect(
      readImportRequest({
        ...base,
        destination: { kind: "new", client: { ...newClient(), timezone: "Mars/Olympus" } },
      }),
    ).toBe("Choose a valid timezone.");
    expect(
      readImportRequest({
        ...base,
        destination: { kind: "new", client: { ...newClient(), targetCpa: -4 } },
      }),
    ).toBe("Target CPA must be a positive amount.");
  });

  it("saves targets only for the workspace's own clients", async () => {
    const { ana, anaWs, ben } = await setup();
    const bloom = await importInto(
      ana,
      anaWs.id,
      request(ecommerceCsv(), { kind: "new", client: newClient() }),
    );
    if (!bloom.ok) throw new Error(bloom.message);
    expect(await ana.updateTargets(bloom.result.clientId, 25, 3.2)).toBe(true);
    expect(await ben.updateTargets(bloom.result.clientId, 1, null)).toBe(false);
    const repository = await load(ana, anaWs.id);
    expect(repository.getClient(bloom.result.clientId)).toMatchObject({
      targetCpa: 25,
      targetRoas: 3.2,
    });
    expect(readTargets({ targetCpa: 0, targetRoas: null }, true)).toMatchObject({ ok: false });
    expect(readTargets({ targetCpa: null, targetRoas: 3 }, false)).toMatchObject({ ok: false });
    expect(readTargets({ targetCpa: 12.5, targetRoas: null }, false)).toEqual({
      ok: true,
      targetCpa: 12.5,
      targetRoas: null,
    });
  });
});

describe("imported data from Postgres flows through the existing analytics unchanged", async () => {
  const { ana, anaWs } = await setup();
  const bloom = await importInto(
    ana,
    anaWs.id,
    request(ecommerceCsv(), { kind: "new", client: newClient() }),
  );
  const harbour = await importInto(
    ana,
    anaWs.id,
    request(
      leadCsv(),
      {
        kind: "new",
        client: newClient({ name: "Harbour Physio", type: "lead_generation", targetCpa: null }),
      },
      "lead_generation",
    ),
  );
  if (!bloom.ok || !harbour.ok) throw new Error("fixture import failed");
  const ws = await workspaceFor(ana, anaWs.id, bloom.result.clientId);

  it("anchors periods to the last imported day", () => {
    expect(periodAnchor("2026-10-03", "2026-09-30")).toBe("2026-09-30");
    expect(ws.periods.current).toEqual({ start: "2026-09-24", end: "2026-09-30" });
    expect(ws.periods.previous).toEqual({ start: "2026-09-17", end: "2026-09-23" });
    expect(ws.dataSource.kind).toBe("meta_csv");
    expect(ws.agency.name).toBe("Ana's workspace");
  });

  it("produces correct Overview totals", () => {
    const summary = getClientPeriodSummary(ws.repository, ws.client, ws.periods);
    const now = expected(ECOM_ADS, 7, 14);
    expect(summary.comparison.current.totals.spend).toBeCloseTo(now.spend, 4);
    expect(summary.comparison.current.totals.conversions).toBe(now.conversions);
    expect(summary.comparison.previous.totals.revenue).toBeCloseTo(
      expected(ECOM_ADS, 0, 7).revenue,
      4,
    );
    expect(summary.comparison.current.derived.ctr).toBeCloseTo(
      now.clicks / now.impressions,
      12,
    );
  });

  it("produces Campaigns rows and Creatives metrics", () => {
    const rows = getCampaignRows(ws.repository, ws.client, ws.periods);
    expect(rows).toHaveLength(3);
    const serum = rows.find((r) => r.campaign.name === "Prospecting | Broad | Spring Serum")!;
    expect(serum).toMatchObject({ adSetCount: 2, adCount: 2 });
    expect(serum.current.totals.spend).toBeCloseTo(
      expected(ECOM_ADS.slice(0, 2), 7, 14).spend,
      4,
    );
    expect(getCreativeRows(ws.repository, ws.client, ws.periods)).toHaveLength(5);
    expect(buildCreativeBoard(ws).types.map((t) => t.type)).toEqual(["unknown"]);
  });

  it("raises Insights findings and answers Ask Analyst from stored metrics", () => {
    const findings = runInsightEngine(
      collectInsightFacts(ws.repository, ws.client, ws.periods),
    );
    expect(findings.find((f) => f.detector === "zero_conversion_spend")?.entity.name).toBe(
      "Prospecting | Lookalike 3% | Night Cream",
    );
    const waste = answerQuestion("Where am I wasting spend?", collectAskData(ws)).answer;
    expect(waste.state).toBe("available");
    expect(waste.entities.map((e) => e.name)).toContain(
      "Prospecting | Lookalike 3% | Night Cream",
    );
  });

  it("omits targets and ROAS for a lead client without them", async () => {
    const lead = await workspaceFor(ana, anaWs.id, harbour.result.clientId);
    expect(lead.client).toMatchObject({
      targetCpa: null,
      targetRoas: null,
      revenueTracked: false,
    });
    const findings = runInsightEngine(
      collectInsightFacts(lead.repository, lead.client, lead.periods),
    );
    expect(findings.every((f) => f.target === null && f.detector !== "roas_decline")).toBe(
      true,
    );
    expect(
      getClientPeriodSummary(lead.repository, lead.client, lead.periods).comparison.current
        .totals.conversions,
    ).toBe(expected(LEAD_ADS, 7, 14).conversions);
  });
});

it("fixture days are the 14 days ending 30 September", () => {
  expect([DAYS_14[0], DAYS_14.at(-1)]).toEqual(["2026-09-17", "2026-09-30"]);
});

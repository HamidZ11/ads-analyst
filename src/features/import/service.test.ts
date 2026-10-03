import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { composeDataset } from "@/data/compose";
import {
  DAYS_14,
  ECOM_ADS,
  LEAD_ADS,
  ecommerceCsv,
  leadCsv,
  metricsFor,
  type AdSpec,
} from "@/data/import/__fixtures__/meta-exports";
import { inspectHeaders, parseCsv, proposeMapping } from "@/data/import";
import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import {
  FileImportStore,
  MemoryImportStore,
  StoreReadError,
  type ImportStore,
} from "@/data/store";
import { answerQuestion } from "@/domain/ask/answer";
import { runInsightEngine } from "@/domain/insights";
import {
  comparisonLabel,
  periodAnchor,
  periodPairForPreset,
  type DatePreset,
} from "@/domain/periods";
import type { ClientType } from "@/domain/types";
import {
  getCampaignRows,
  getClientPeriodSummary,
  getCreativeRows,
} from "@/features/analytics/queries";
import { collectAskData } from "@/features/ask/facts";
import { buildCreativeBoard } from "@/features/creatives/board-data";
import { collectInsightFacts } from "@/features/insights/facts";
import type { Workspace } from "@/features/workspace/server";
import {
  readImportRequest,
  runImport,
  updateTargets,
  type ImportRequest,
  type NewClientInput,
} from "./service";

const TODAY = "2026-10-03";
const NOW = new Date(`${TODAY}T10:00:00Z`);
const seed = buildSeedDataset({ anchorDate: TODAY });
const seededClients = seed.clients;
const seedCounts = { campaigns: seed.campaigns.length, metrics: seed.dailyMetrics.length };

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

function importEcommerce(store: ImportStore = new MemoryImportStore()) {
  const outcome = runImport(
    request(ecommerceCsv(), { kind: "new", client: newClient() }),
    store,
    { now: NOW, seededClients },
  );
  if (!outcome.ok) throw new Error(outcome.message);
  return { store, result: outcome.result };
}

function workspaceFor(
  repo: InMemoryRepository,
  clientId: string,
  preset: DatePreset = "7d",
): Workspace {
  const client = repo.getClient(clientId)!;
  const coverage = repo.getCoverage(client.id);
  const periods = periodPairForPreset(preset, periodAnchor(TODAY, coverage?.lastDate ?? null));
  return {
    repository: repo,
    agency: repo.getAgency(),
    clients: repo.listClients(),
    client,
    adAccount: repo.listAdAccounts(client.id)[0] ?? null,
    coverage,
    dataSource: repo.getDataSource(client.id),
    today: TODAY,
    preset,
    periods,
    comparison: comparisonLabel(periods),
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

describe("import service", () => {
  it("creates a client from a valid export and records the source", () => {
    const { store, result } = importEcommerce();
    expect(result).toMatchObject({
      clientName: "Bloom Botanicals",
      currency: "GBP",
      firstDate: "2026-09-17",
      lastDate: "2026-09-30",
      campaigns: 3,
      ads: 5,
      daysAdded: 70,
      daysReplaced: 0,
    });
    expect(result.spend).toBeCloseTo(expected(ECOM_ADS, 0, 14).spend, 6);
    const [bundle] = store.read().clients;
    expect(bundle.client).toMatchObject({
      targetCpa: 20,
      targetRoas: null,
      revenueTracked: true,
    });
    expect(bundle.source.imports[0]).toMatchObject({
      source: "meta_csv",
      fileName: "export.csv",
      rows: 70,
      accountExternalId: "1234567890",
      outcomeColumn: "Purchases",
      revenueColumn: "Purchases conversion value (GBP)",
      importedAt: NOW.toISOString(),
    });
  });

  it("does not double-count a repeated import of the same file", () => {
    const { store, result } = importEcommerce();
    const again = runImport(
      request(ecommerceCsv(), { kind: "existing", clientId: result.clientId }),
      store,
      { now: NOW, seededClients },
    );
    expect(again).toMatchObject({ ok: true, result: { daysAdded: 0, daysReplaced: 70 } });
    const repo = new InMemoryRepository(composeDataset(seed, store.read()));
    const total = repo
      .queryMetrics({ clientId: result.clientId })
      .reduce((s, m) => s + m.spend, 0);
    expect(total).toBeCloseTo(expected(ECOM_ADS, 0, 14).spend, 6);
    expect(store.read().clients[0].source.imports).toHaveLength(2);
  });

  it("refuses demo clients, unknown clients, duplicate names and a ROAS target without value", () => {
    const store = new MemoryImportStore();
    const csv = ecommerceCsv();
    expect(
      runImport(request(csv, { kind: "existing", clientId: "cli_luxe" }), store, {
        now: NOW,
        seededClients,
      }),
    ).toMatchObject({ ok: false, status: 403 });
    expect(
      runImport(request(csv, { kind: "existing", clientId: "cli_nope" }), store, {
        now: NOW,
        seededClients,
      }),
    ).toMatchObject({ ok: false, status: 404 });
    expect(
      runImport(
        request(csv, { kind: "new", client: newClient({ name: "luxe skin co." }) }),
        store,
        { now: NOW, seededClients },
      ),
    ).toMatchObject({ ok: false, status: 409 });
    const lead = leadCsv();
    expect(
      runImport(
        request(
          lead,
          {
            kind: "new",
            client: newClient({
              name: "Harbour Physio",
              type: "lead_generation",
              targetRoas: 3,
            }),
          },
          "lead_generation",
        ),
        store,
        { now: NOW, seededClients },
      ),
    ).toMatchObject({ ok: false, status: 422 });
    expect(store.read().clients).toEqual([]);
  });

  it("returns validation issues and stores nothing when the file conflicts with the client", () => {
    const store = new MemoryImportStore();
    const usd = runImport(
      request(ecommerceCsv(), { kind: "new", client: newClient({ currency: "USD" }) }),
      store,
      { now: NOW, seededClients },
    );
    expect(usd.ok).toBe(false);
    if (!usd.ok) expect(usd.issues?.map((i) => i.code)).toContain("currency_mismatch");
    const { result } = importEcommerce(store);
    // The ecommerce client records value; a lead export without a value column is refused.
    const lead = runImport(
      request(leadCsv(), { kind: "existing", clientId: result.clientId }, "lead_generation"),
      store,
      { now: NOW, seededClients },
    );
    expect(lead.ok).toBe(false);
    if (!lead.ok) expect(lead.issues?.map((i) => i.code)).toContain("missing_revenue");
    expect(store.read().clients[0].source.imports).toHaveLength(1);
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
    const ok = readImportRequest({
      ...base,
      fileName: "<b>x\u0000.csv</b>",
      destination: { kind: "new", client: { ...newClient(), name: "  Bloom‮  " } },
    });
    expect(typeof ok).toBe("object");
    if (typeof ok === "object" && ok.destination.kind === "new") {
      expect(ok.destination.client.name).toBe("Bloom");
      expect(ok.fileName).toBe("<b>x .csv</b>");
    }
  });

  it("edits targets for imported clients only", () => {
    const { store, result } = importEcommerce();
    expect(updateTargets(store, result.clientId, { targetCpa: 25, targetRoas: 3.2 })).toEqual({
      ok: true,
    });
    expect(store.read().clients[0].client).toMatchObject({ targetCpa: 25, targetRoas: 3.2 });
    expect(
      updateTargets(store, result.clientId, { targetCpa: null, targetRoas: null }),
    ).toEqual({ ok: true });
    expect(store.read().clients[0].client).toMatchObject({ targetCpa: null, targetRoas: null });
    expect(updateTargets(store, "cli_luxe", { targetCpa: 1, targetRoas: null })).toMatchObject({
      ok: false,
    });
    expect(
      updateTargets(store, result.clientId, { targetCpa: 0, targetRoas: null }),
    ).toMatchObject({ ok: false });
  });
});

describe("imported data flows through the existing analytics unchanged", () => {
  const { store, result } = importEcommerce();
  const lead = runImport(
    request(
      leadCsv(),
      {
        kind: "new",
        client: newClient({ name: "Harbour Physio", type: "lead_generation", targetCpa: null }),
      },
      "lead_generation",
    ),
    store,
    { now: NOW, seededClients },
  );
  if (!lead.ok) throw new Error(lead.message);
  const repo = new InMemoryRepository(composeDataset(seed, store.read()));
  const ws = workspaceFor(repo, result.clientId);

  it("anchors periods to the last imported day", () => {
    expect(periodAnchor(TODAY, "2026-09-30")).toBe("2026-09-30");
    expect(periodAnchor(TODAY, TODAY)).toBe(TODAY);
    expect(periodAnchor(TODAY, null)).toBe(TODAY);
    expect(ws.periods.current).toEqual({ start: "2026-09-24", end: "2026-09-30" });
    expect(ws.periods.previous).toEqual({ start: "2026-09-17", end: "2026-09-23" });
    expect(ws.dataSource.kind).toBe("meta_csv");
  });

  it("produces correct Overview totals", () => {
    const summary = getClientPeriodSummary(repo, ws.client, ws.periods);
    const now = expected(ECOM_ADS, 7, 14);
    const before = expected(ECOM_ADS, 0, 7);
    expect(summary.comparison.current.totals.spend).toBeCloseTo(now.spend, 6);
    expect(summary.comparison.current.totals.conversions).toBe(now.conversions);
    expect(summary.comparison.previous.totals.revenue).toBeCloseTo(before.revenue, 6);
    expect(summary.comparison.current.derived.ctr).toBeCloseTo(
      now.clicks / now.impressions,
      12,
    );
    expect(summary.trend).toHaveLength(14);
  });

  it("produces Campaigns rows per imported campaign", () => {
    const rows = getCampaignRows(repo, ws.client, ws.periods);
    expect(rows).toHaveLength(3);
    const serum = rows.find((r) => r.campaign.name === "Prospecting | Broad | Spring Serum")!;
    expect(serum).toMatchObject({ adSetCount: 2, adCount: 2 });
    expect(serum.current.totals.spend).toBeCloseTo(
      expected(ECOM_ADS.slice(0, 2), 7, 14).spend,
      6,
    );
    const night = rows.find((r) => r.campaign.name.endsWith("Night Cream"))!;
    expect(night.current.totals.conversions).toBe(0);
    expect(night.current.derived.cpa).toBeNull();
  });

  it("produces Creatives metrics, one creative per ad, with honest formats and artwork", () => {
    const rows = getCreativeRows(repo, ws.client, ws.periods);
    expect(rows).toHaveLength(5);
    const ugc = rows.find((r) => r.creative.name.startsWith("Serum – UGC"))!;
    expect(ugc.current.totals.spend).toBeCloseTo(
      expected(ECOM_ADS.slice(0, 1), 7, 14).spend,
      6,
    );
    expect(ugc.creative).toMatchObject({ type: "unknown", thumbnail: { kind: "unavailable" } });
    const board = buildCreativeBoard(ws);
    expect(board.types.map((t) => t.type)).toEqual(["unknown"]);
    expect(board.types[0].share).toBeCloseTo(1, 10);
  });

  it("raises Insights findings where thresholds are met", () => {
    const findings = runInsightEngine(collectInsightFacts(repo, ws.client, ws.periods));
    const zero = findings.find((f) => f.detector === "zero_conversion_spend");
    expect(zero?.entity.name).toBe("Prospecting | Lookalike 3% | Night Cream");
    expect(zero?.spendInvolved).toBeCloseTo(expected(ECOM_ADS.slice(4), 7, 14).spend, 6);
    expect(zero?.reason).toContain("£20 cost per purchase target");
  });

  it("gives Ask Analyst facts derived from imported metrics", () => {
    const data = collectAskData(ws);
    expect(data.facts.account.current.totals.spend).toBeCloseTo(
      expected(ECOM_ADS, 7, 14).spend,
      6,
    );
    const waste = answerQuestion("Where am I wasting spend?", data).answer;
    expect(waste.state).toBe("available");
    expect(waste.entities.map((e) => e.name)).toContain(
      "Prospecting | Lookalike 3% | Night Cream",
    );
  });

  it("omits target language for a client without targets and ROAS without value", () => {
    const harbour = workspaceFor(repo, lead.result.clientId);
    expect(harbour.client).toMatchObject({
      targetCpa: null,
      targetRoas: null,
      revenueTracked: false,
    });
    const findings = runInsightEngine(
      collectInsightFacts(repo, harbour.client, harbour.periods),
    );
    expect(findings.every((f) => f.target === null && !/target/.test(f.reason))).toBe(true);
    expect(findings.every((f) => f.detector !== "roas_decline")).toBe(true);
    expect(
      getClientPeriodSummary(repo, harbour.client, harbour.periods).comparison.current.totals
        .conversions,
    ).toBe(expected(LEAD_ADS, 7, 14).conversions);
  });

  it("keeps imported clients and demo clients isolated", () => {
    const seedOnly = new InMemoryRepository(seed);
    for (const demo of seededClients) {
      expect(repo.listCampaigns(demo.id)).toEqual(seedOnly.listCampaigns(demo.id));
      expect(repo.queryMetrics({ clientId: demo.id }).length).toBe(
        seedOnly.queryMetrics({ clientId: demo.id }).length,
      );
      expect(repo.getDataSource(demo.id).kind).toBe("seed");
    }
    expect(seed.campaigns.length).toBe(seedCounts.campaigns);
    expect(seed.dailyMetrics.length).toBe(seedCounts.metrics);
    const bloomAds = repo.listAdsForClient(result.clientId).map((a) => a.id);
    expect(repo.queryMetrics({ clientId: lead.result.clientId, entityIds: bloomAds })).toEqual(
      [],
    );
    expect(repo.queryMetrics({ clientId: "cli_luxe", entityIds: bloomAds })).toEqual([]);
    expect(
      repo
        .listCampaigns(lead.result.clientId)
        .every((c) => c.clientId === lead.result.clientId),
    ).toBe(true);
    expect(new Set(repo.listClients().map((c) => c.id)).size).toBe(seededClients.length + 2);
  });
});

describe("file store", () => {
  const dir = mkdtempSync(join(tmpdir(), "ad-analyst-store-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("round-trips state atomically and changes its revision", () => {
    const store = new FileImportStore(dir);
    expect(store.read()).toEqual({ version: 1, clients: [] });
    expect(store.revision()).toBe("none");
    importEcommerce(store);
    expect(store.read().clients).toHaveLength(1);
    expect(store.revision()).not.toBe("none");
  });

  it("refuses to overwrite unreadable data", () => {
    const store = new FileImportStore(dir);
    writeFileSync(store.file, "{not json");
    expect(() => store.read()).toThrow(StoreReadError);
    const outcome = runImport(
      request(ecommerceCsv(), { kind: "new", client: newClient({ name: "Other" }) }),
      store,
      { now: NOW, seededClients },
    );
    expect(outcome).toMatchObject({ ok: false, status: 500 });
    expect(readFileSync(store.file, "utf8")).toBe("{not json");
  });
});

it("fixture days are the 14 days ending 30 September", () => {
  expect([DAYS_14[0], DAYS_14.at(-1)]).toEqual(["2026-09-17", "2026-09-30"]);
});

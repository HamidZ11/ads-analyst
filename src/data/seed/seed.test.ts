import { describe, expect, it } from "vitest";
import { dailySeries, deriveMetrics, snapshot } from "@/domain/metrics";
import { addDays, eachDay, periodPairForPreset, rangeForPreset } from "@/domain/periods";
import type { Dataset } from "@/domain/types";
import { InMemoryRepository } from "../repository";
import { buildSeedDataset, SEED_DAYS } from "./index";

const ANCHOR = "2026-10-02";
const dataset: Dataset = buildSeedDataset({ anchorDate: ANCHOR });
const repository = new InMemoryRepository(dataset);
const luxe = repository.getClient("cli_luxe")!;

function ids(items: readonly { id: string }[]): string[] {
  return items.map((i) => i.id);
}

describe("seeded dataset integrity", () => {
  it("is deterministic for a given anchor date", () => {
    const again = buildSeedDataset({ anchorDate: ANCHOR });
    expect(again.dailyMetrics).toEqual(dataset.dailyMetrics);
  });

  it("has no duplicate ids within any entity type", () => {
    for (const items of [
      dataset.clients,
      dataset.adAccounts,
      dataset.campaigns,
      dataset.adSets,
      dataset.ads,
      dataset.creatives,
    ]) {
      const list = ids(items);
      expect(new Set(list).size).toBe(list.length);
    }
    const metricKeys = dataset.dailyMetrics.map(
      (m) => `${m.entityType}:${m.entityId}:${m.date}`,
    );
    expect(new Set(metricKeys).size).toBe(metricKeys.length);
  });

  it("seeds the agency and the three expected clients", () => {
    expect(dataset.agency.name).toBe("Northstar Media");
    expect(dataset.clients.map((c) => c.name)).toEqual([
      "Luxe Skin Co.",
      "Peak Fitness",
      "Arc Cloud",
    ]);
    expect(luxe).toMatchObject({
      currency: "GBP",
      timezone: "Europe/London",
      targetCpa: 28,
      targetRoas: 3.5,
    });
    expect(repository.getClient("cli_peak")).toMatchObject({
      currency: "GBP",
      targetCpa: 18,
      targetRoas: null,
    });
    expect(repository.getClient("cli_arc")).toMatchObject({
      currency: "USD",
      timezone: "America/New_York",
      targetCpa: 85,
      targetRoas: null,
    });
  });

  it("gives the flagship client the required volume of structure", () => {
    const campaigns = repository.listCampaigns(luxe.id);
    const adSets = repository.listAdSetsForClient(luxe.id);
    const ads = repository.listAdsForClient(luxe.id);
    const creatives = repository.listCreatives(luxe.id);
    expect(campaigns.length).toBeGreaterThanOrEqual(6);
    expect(campaigns.length).toBeLessThanOrEqual(10);
    expect(campaigns.every((c) => adSets.some((s) => s.campaignId === c.id))).toBe(true);
    expect(ads.length).toBeGreaterThanOrEqual(20);
    expect(ads.length).toBeLessThanOrEqual(30);
    expect(creatives.length).toBeGreaterThanOrEqual(20);
    expect(creatives.length).toBeLessThanOrEqual(30);
  });

  it("stores only additive metrics with sane values", () => {
    for (const m of dataset.dailyMetrics) {
      expect(m.entityType).toBe("ad");
      expect(m.spend).toBeGreaterThanOrEqual(0);
      expect(m.revenue).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(m.conversions)).toBe(true);
      expect(Number.isInteger(m.impressions)).toBe(true);
      expect(Number.isInteger(m.clicks)).toBe(true);
      expect(m.clicks).toBeLessThanOrEqual(m.impressions);
      expect(m.conversions).toBeLessThanOrEqual(m.clicks);
    }
  });
});

describe("hierarchy relationships", () => {
  it("links every entity to a valid parent and every ad to a creative of the same client", () => {
    const clientIds = new Set(ids(dataset.clients));
    const accountIds = new Set(ids(dataset.adAccounts));
    const campaignIds = new Set(ids(dataset.campaigns));
    const adSetIds = new Set(ids(dataset.adSets));
    const creativeIds = new Set(ids(dataset.creatives));

    for (const account of dataset.adAccounts)
      expect(clientIds.has(account.clientId)).toBe(true);
    for (const campaign of dataset.campaigns) {
      expect(accountIds.has(campaign.adAccountId)).toBe(true);
      expect(clientIds.has(campaign.clientId)).toBe(true);
    }
    for (const adSet of dataset.adSets) expect(campaignIds.has(adSet.campaignId)).toBe(true);
    for (const ad of dataset.ads) {
      expect(adSetIds.has(ad.adSetId)).toBe(true);
      expect(creativeIds.has(ad.creativeId)).toBe(true);
      const lineage = repository.getAdLineage(ad.id)!;
      expect(lineage.creative.clientId).toBe(lineage.client.id);
      expect(lineage.campaign.clientId).toBe(lineage.client.id);
    }
  });

  it("records metrics only for ads that exist", () => {
    const adIds = new Set(ids(dataset.ads));
    expect(dataset.dailyMetrics.every((m) => adIds.has(m.entityId))).toBe(true);
  });

  it("uses every creative in at least one ad", () => {
    const used = new Set(dataset.ads.map((a) => a.creativeId));
    for (const creative of dataset.creatives) expect(used.has(creative.id)).toBe(true);
  });

  it("scopes repository queries to the requested client", () => {
    const peakRows = repository.queryMetrics({ clientId: "cli_peak" });
    const peakAds = new Set(ids(repository.listAdsForClient("cli_peak")));
    expect(peakRows.length).toBeGreaterThan(0);
    expect(peakRows.every((r) => peakAds.has(r.entityId))).toBe(true);
    // Asking for another client's ad under the wrong client returns nothing.
    expect(
      repository.queryMetrics({ clientId: "cli_peak", entityIds: ["ad_luxe_01a1"] }),
    ).toEqual([]);
  });
});

describe("date coverage", () => {
  it("covers exactly the seeded window ending at the anchor for every client", () => {
    const expectedFirst = addDays(ANCHOR, -(SEED_DAYS - 1));
    for (const client of dataset.clients) {
      const coverage = repository.getCoverage(client.id)!;
      expect(coverage.lastDate).toBe(ANCHOR);
      expect(coverage.firstDate).toBe(expectedFirst);
      expect(coverage.days).toBe(SEED_DAYS);
    }
  });

  it("has no gaps for continuously active ads", () => {
    const rows = repository.queryMetrics({ clientId: luxe.id, entityIds: ["ad_luxe_01a1"] });
    const dates = rows.map((r) => r.date).sort();
    expect(dates).toEqual(eachDay({ start: addDays(ANCHOR, -(SEED_DAYS - 1)), end: ANCHOR }));
  });

  it("stops recording paused ads after their last active day", () => {
    const rows = repository.queryMetrics({ clientId: luxe.id, entityIds: ["ad_luxe_09a1"] });
    expect(rows.length).toBe(25);
    expect(rows.at(-1)!.date < rangeForPreset("30d", ANCHOR).start).toBe(true);
  });
});

describe("deliberate performance patterns emerge from the numbers", () => {
  const periods = periodPairForPreset("7d", ANCHOR);
  const compareCampaign = (campaignId: string) => {
    const adIds = repository
      .listAdSets(campaignId)
      .flatMap((s) => ids(repository.listAds(s.id)));
    return {
      current: snapshot(
        repository.queryMetrics({
          clientId: luxe.id,
          entityIds: adIds,
          range: periods.current,
        }),
      ),
      previous: snapshot(
        repository.queryMetrics({
          clientId: luxe.id,
          entityIds: adIds,
          range: periods.previous,
        }),
      ),
    };
  };

  it("A. a scaling winner: rising spend, more conversions, CPA under target and ROAS improving", () => {
    const { current, previous } = compareCampaign("cmp_luxe_01");
    expect(current.totals.spend).toBeGreaterThan(previous.totals.spend * 1.08);
    expect(current.totals.conversions).toBeGreaterThan(previous.totals.conversions);
    expect(current.derived.cpa!).toBeLessThan(luxe.targetCpa);
    expect(current.derived.roas!).toBeGreaterThan(previous.derived.roas!);
    expect(current.derived.roas!).toBeGreaterThan(luxe.targetRoas!);
  });

  it("B. a fatigued creative: CTR falling steadily on stable CPM and meaningful spend, CPA worsening", () => {
    const adIds = repository
      .listAdsForClient(luxe.id)
      .filter((a) => a.creativeId === "cr_luxe_05")
      .map((a) => a.id);
    const window = rangeForPreset("30d", ANCHOR);
    const rows = repository.queryMetrics({
      clientId: luxe.id,
      entityIds: adIds,
      range: window,
    });
    const daily = dailySeries(rows, window).map((p) => deriveMetrics(p).ctr!);

    // Steady decline: a negative least-squares slope that is large relative to the level,
    // and the second half of the window clearly below the first.
    const n = daily.length;
    const meanX = (n - 1) / 2;
    const meanY = daily.reduce((s, v) => s + v, 0) / n;
    const slope =
      daily.reduce((s, v, i) => s + (i - meanX) * (v - meanY), 0) /
      daily.reduce((s, _v, i) => s + (i - meanX) ** 2, 0);
    expect(slope).toBeLessThan(0);
    expect((slope * n) / meanY).toBeLessThan(-0.3);

    const half = Math.floor(n / 2);
    const firstHalf = snapshot(rows.filter((r) => r.date < addDays(window.start, half)));
    const secondHalf = snapshot(rows.filter((r) => r.date >= addDays(window.start, half)));
    expect(secondHalf.derived.ctr!).toBeLessThan(firstHalf.derived.ctr! * 0.8);

    // Spend still meaningful, CPM roughly stable, CPA worsening.
    expect(secondHalf.totals.spend).toBeGreaterThan(1000);
    expect(Math.abs(secondHalf.derived.cpm! / firstHalf.derived.cpm! - 1)).toBeLessThan(0.1);
    expect(secondHalf.derived.cpa!).toBeGreaterThan(firstHalf.derived.cpa! * 1.3);

    // And it shows up in the default 7-day comparison too.
    const compare = {
      current: snapshot(
        repository.queryMetrics({
          clientId: luxe.id,
          entityIds: adIds,
          range: periods.current,
        }),
      ),
      previous: snapshot(
        repository.queryMetrics({
          clientId: luxe.id,
          entityIds: adIds,
          range: periods.previous,
        }),
      ),
    };
    expect(compare.current.derived.ctr!).toBeLessThan(compare.previous.derived.ctr!);
  });

  it("C. a wasteful campaign: meaningful spend with almost no conversions", () => {
    const adIds = repository
      .listAdSets("cmp_luxe_03")
      .flatMap((s) => ids(repository.listAds(s.id)));
    const all = snapshot(repository.queryMetrics({ clientId: luxe.id, entityIds: adIds }));
    expect(all.totals.spend).toBeGreaterThan(4000);
    expect(all.totals.conversions).toBeLessThan(15);
    expect(all.derived.cpa!).toBeGreaterThan(luxe.targetCpa * 5);
  });

  it("D. a recovering campaign: poor previous period, markedly better current period", () => {
    const { current, previous } = compareCampaign("cmp_luxe_04");
    expect(current.derived.cpa!).toBeLessThan(previous.derived.cpa! * 0.7);
    expect(current.totals.conversions).toBeGreaterThan(previous.totals.conversions * 1.4);
    expect(
      Math.abs(current.totals.spend - previous.totals.spend) / previous.totals.spend,
    ).toBeLessThan(0.15);
  });

  it("E. an underfunded strong ad: best CPA and ROAS in its campaign on a small share of spend", () => {
    const adIds = repository
      .listAdSets("cmp_luxe_07")
      .flatMap((s) => ids(repository.listAds(s.id)));
    const perAd = adIds.map((id) => ({
      id,
      ...snapshot(
        repository.queryMetrics({ clientId: luxe.id, entityIds: [id], range: periods.current }),
      ),
    }));
    const campaignSpend = perAd.reduce((sum, a) => sum + a.totals.spend, 0);
    const star = perAd.find((a) => a.id === "ad_luxe_07a1")!;
    expect(star.totals.spend / campaignSpend).toBeLessThan(0.15);
    for (const other of perAd.filter((a) => a.id !== star.id && a.totals.conversions > 0)) {
      expect(star.derived.cpa!).toBeLessThan(other.derived.cpa!);
      expect(star.derived.roas!).toBeGreaterThan(other.derived.roas!);
    }
    expect(star.derived.cpa!).toBeLessThan(luxe.targetCpa * 0.6);
  });

  it("F. spend increasing while conversions decline", () => {
    const { current, previous } = compareCampaign("cmp_luxe_05");
    expect(current.totals.spend).toBeGreaterThan(previous.totals.spend * 1.15);
    expect(current.totals.conversions).toBeLessThan(previous.totals.conversions);
    expect(current.derived.cpa!).toBeGreaterThan(previous.derived.cpa! * 1.3);
  });
});

import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import { PRIORITY_ORDER, runInsightEngine, type Finding } from "@/domain/insights";
import { percentChange, snapshot } from "@/domain/metrics";
import { periodPairForPreset, type DatePreset } from "@/domain/periods";
import type { Dataset } from "@/domain/types";
import { collectInsightFacts } from "./facts";

/**
 * The seed is anchored to a date. Its daily noise makes 7-day windows differ
 * from one anchor to the next (the Vitamin C creative's 7-day CTR drop ranges
 * from 6% to 23% across a week), so the exact 7-day set is pinned to one
 * anchor and the longer view is checked across a whole week of anchors.
 */
const ANCHOR = "2026-10-03";
const dataset: Dataset = buildSeedDataset({ anchorDate: ANCHOR });
const repository = new InMemoryRepository(dataset);
const client = (id: string) => repository.getClient(id)!;

function run(clientId: string, preset: DatePreset = "7d", repo = repository) {
  return runInsightEngine(
    collectInsightFacts(repo, repo.getClient(clientId)!, periodPairForPreset(preset, ANCHOR)),
  );
}

/** Independent recomputation straight from the repository, for evidence checks. */
function measure(clientId: string, adIds: string[], preset: DatePreset = "7d") {
  const periods = periodPairForPreset(preset, ANCHOR);
  const q = (range: typeof periods.current) =>
    snapshot(repository.queryMetrics({ clientId, entityIds: adIds, range }));
  return { current: q(periods.current), previous: q(periods.previous) };
}

const campaignAds = (campaignId: string) =>
  repository.listAdSets(campaignId).flatMap((s) => repository.listAds(s.id).map((a) => a.id));

const pairs = (findings: Finding[]) => findings.map((f) => `${f.detector}:${f.entity.id}`);

describe("seeded scenarios are detected from the metrics", () => {
  const luxe = run("cli_luxe");

  it("finds the six documented Luxe Skin Co. patterns, plus concentration, in the 7-day view", () => {
    expect(pairs(luxe).sort()).toEqual(
      [
        "campaign_deterioration:cmp_luxe_05", // F. spend up, conversions down
        "cpa_spike:cmp_luxe_02", // campaign carrying the fatigued creative
        "zero_conversion_spend:cmp_luxe_03", // C. wasteful lookalikes
        "scaling_winner:cmp_luxe_01", // A. scaling winner
        "campaign_improvement:cmp_luxe_04", // D. recovering retargeting
        "underfunded_winner:ad_luxe_07a1", // E. underfunded strong ad
        "creative_fatigue:cr_luxe_05", // B. fatigued creative
        "spend_concentration:acc_luxe_meta",
      ].sort(),
    );
  });

  it("finds the same patterns in the 14-day view on every anchor across a week", () => {
    for (const anchor of [
      "2026-09-27",
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
    ]) {
      const repo = new InMemoryRepository(buildSeedDataset({ anchorDate: anchor }));
      const found = pairs(
        runInsightEngine(
          collectInsightFacts(
            repo,
            repo.getClient("cli_luxe")!,
            periodPairForPreset("14d", anchor),
          ),
        ),
      );
      expect(found).toEqual(
        expect.arrayContaining([
          "campaign_deterioration:cmp_luxe_05",
          "zero_conversion_spend:cmp_luxe_03",
          "scaling_winner:cmp_luxe_01",
          "campaign_improvement:cmp_luxe_04",
          "underfunded_winner:ad_luxe_07a1",
          "creative_fatigue:cr_luxe_05",
          "spend_concentration:acc_luxe_meta",
        ]),
      );
    }
  });

  it("assigns priorities and orders high impact, opportunity, watch, then by spend", () => {
    const ranks = luxe.map((f) => PRIORITY_ORDER.indexOf(f.priority));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    for (const priority of PRIORITY_ORDER) {
      const spends = luxe.filter((f) => f.priority === priority).map((f) => f.spendInvolved);
      expect(spends).toEqual([...spends].sort((a, b) => b - a));
    }
    expect(luxe.filter((f) => f.priority === "high").map((f) => f.entity.id)).toEqual([
      "cmp_luxe_05",
      "cmp_luxe_02",
      "cmp_luxe_03",
    ]);
  });

  it("derives evidence from the stored metrics, not from fixed text", () => {
    const deterioration = luxe.find((f) => f.detector === "campaign_deterioration")!;
    const m = measure("cli_luxe", campaignAds("cmp_luxe_05"));
    expect(deterioration.evidence[0].value).toBeCloseTo(m.current.totals.spend, 6);
    expect(deterioration.evidence[0].change).toBeCloseTo(
      percentChange(m.current.totals.spend, m.previous.totals.spend)!,
      10,
    );
    expect(deterioration.evidence[1].value).toBe(m.current.totals.conversions);
    expect(deterioration.evidence[2].value).toBeCloseTo(m.current.derived.cpa!, 10);
    expect(deterioration.target).toMatchObject({ metric: "cpa", target: 28, relation: "over" });
    expect(deterioration.target!.difference).toBeCloseTo(m.current.derived.cpa! - 28, 10);

    const zero = luxe.find((f) => f.detector === "zero_conversion_spend")!;
    const z = measure("cli_luxe", campaignAds("cmp_luxe_03"));
    expect(z.current.totals.conversions).toBe(0);
    expect(zero.spendInvolved).toBeCloseTo(z.current.totals.spend, 6);

    const fatigue = luxe.find((f) => f.detector === "creative_fatigue")!;
    const ads = repository
      .listAdsForClient("cli_luxe")
      .filter((a) => a.creativeId === "cr_luxe_05")
      .map((a) => a.id);
    const c = measure("cli_luxe", ads);
    expect(fatigue.evidence[0].value).toBeCloseTo(c.current.derived.ctr!, 12);
    expect(fatigue.evidence[0].change).toBeCloseTo(
      percentChange(c.current.derived.ctr, c.previous.derived.ctr)!,
      10,
    );
    expect(fatigue.entity.context).toBe("Video · 2 ads · 1 campaign");
  });

  it("measures the underfunded ad against its own campaign", () => {
    const f = luxe.find((x) => x.detector === "underfunded_winner")!;
    const ad = measure("cli_luxe", ["ad_luxe_07a1"]);
    const camp = measure("cli_luxe", campaignAds("cmp_luxe_07"));
    expect(f.evidence[0].value).toBeCloseTo(ad.current.derived.cpa!, 10);
    expect(f.evidence[1].value).toBeCloseTo(ad.current.totals.spend, 6);
    expect(f.breakdown!.rows.find((r) => r.highlight)!.id).toBe("ad_luxe_07a1");
    expect(f.breakdown!.rows.reduce((s, r) => s + (r.values[0] ?? 0), 0)).toBeCloseTo(
      camp.current.totals.spend,
      6,
    );
  });

  it("computes spend concentration over the delivering campaigns", () => {
    const f = luxe.find((x) => x.detector === "spend_concentration")!;
    const spends = repository
      .listCampaigns("cli_luxe")
      .map((c) => measure("cli_luxe", campaignAds(c.id)).current.totals.spend)
      .filter((s) => s > 0)
      .sort((a, b) => b - a);
    const total = spends.reduce((s, v) => s + v, 0);
    expect(f.evidence[0].value).toBeCloseTo((spends[0] + spends[1] + spends[2]) / total, 12);
    expect(f.evidence[2].value).toBe(spends.length);
  });
});

describe("every finding is evidenced, advisory and factual", () => {
  const all = ["cli_luxe", "cli_peak", "cli_arc"].flatMap((id) =>
    (["7d", "14d", "30d", "today", "yesterday"] as const).flatMap((p) =>
      run(id, p).map((f) => ({ id, p, f })),
    ),
  );

  it("produces findings for every client somewhere in the presets", () => {
    for (const id of ["cli_luxe", "cli_peak", "cli_arc"])
      expect(all.some((x) => x.id === id)).toBe(true);
  });

  it("carries at least three finite evidence values, an action and a reason", () => {
    for (const { f } of all) {
      expect(f.evidence.length).toBeGreaterThanOrEqual(3);
      expect(f.evidence.length).toBeLessThanOrEqual(4);
      for (const e of f.evidence)
        expect(e.value === null || Number.isFinite(e.value)).toBe(true);
      expect(f.evidence.filter((e) => e.value !== null).length).toBeGreaterThanOrEqual(3);
      expect(f.action.length).toBeGreaterThan(10);
      expect(f.reason.length).toBeGreaterThan(20);
      expect(f.headline.endsWith(".")).toBe(true);
    }
  });

  it("never claims a cause or offers an execution action", () => {
    const causal =
      /\b(because|due to|caused|bored|algorithm|suppress|penalis|Meta is|audience is)\b/i;
    const execution = /^(Pause|Increase budget|Apply|Turn off|Enable)\b/;
    for (const { f } of all) {
      expect(f.headline).not.toMatch(causal);
      expect(f.reason).not.toMatch(causal);
      expect(f.action).not.toMatch(execution);
    }
  });

  it("uses each client's vocabulary and currency, and ROAS only where revenue is tracked", () => {
    for (const { id, f } of all) {
      const text = [f.headline, f.reason, ...f.evidence.map((e) => e.label)].join(" ");
      if (id === "cli_peak") expect(text).not.toMatch(/purchase|trial|\$/i);
      if (id === "cli_arc") expect(text).not.toMatch(/purchase|lead|£/i);
      if (id === "cli_luxe") expect(text).not.toMatch(/\blead|trial|\$/i);
      if (id !== "cli_luxe") {
        expect(f.detector).not.toBe("roas_decline");
        expect(text).not.toMatch(/ROAS/);
      }
    }
  });

  it("states a target relationship only against the client's own target", () => {
    for (const { id, f } of all) {
      if (!f.target) continue;
      expect(f.target.target).toBe(
        f.target.metric === "cpa" ? client(id).targetCpa : client(id).targetRoas,
      );
    }
  });
});

describe("isolation", () => {
  it("only reports entities that belong to the selected client", () => {
    for (const id of ["cli_luxe", "cli_peak", "cli_arc"]) {
      const owned = new Set([
        ...repository.listCampaigns(id).map((c) => c.id),
        ...repository.listAdsForClient(id).map((a) => a.id),
        ...repository.listCreatives(id).map((c) => c.id),
        ...repository.listAdAccounts(id).map((a) => a.id),
      ]);
      for (const p of ["7d", "14d", "30d", "today", "yesterday"] as const)
        for (const f of run(id, p)) expect(owned.has(f.entity.id)).toBe(true);
    }
  });

  it("reads only the selected and comparison periods", () => {
    const periods = periodPairForPreset("7d", ANCHOR);
    // Distort every row outside the two periods; the 7-day findings must not move.
    const distorted: Dataset = {
      ...dataset,
      dailyMetrics: dataset.dailyMetrics.map((row) =>
        row.date < periods.previous.start
          ? { ...row, spend: row.spend * 10, conversions: 0, clicks: 0 }
          : row,
      ),
    };
    const other = new InMemoryRepository(distorted);
    for (const id of ["cli_luxe", "cli_peak", "cli_arc"])
      expect(run(id, "7d", other)).toEqual(run(id, "7d"));
  });

  it("recomputes per period rather than reusing one result", () => {
    const week = run("cli_luxe", "7d");
    const month = run("cli_luxe", "30d");
    const weekSpend = week.find((f) => f.entity.id === "cmp_luxe_05")!.spendInvolved;
    const monthSpend = month.find((f) => f.entity.id === "cmp_luxe_05")!.spendInvolved;
    expect(monthSpend).toBeGreaterThan(weekSpend * 2);
  });

  it("is deterministic", () => {
    expect(run("cli_luxe", "14d")).toEqual(run("cli_luxe", "14d"));
  });

  it("returns no findings for a client without metrics", () => {
    const silent = new InMemoryRepository({
      ...dataset,
      dailyMetrics: dataset.dailyMetrics.filter((r) => r.date > ANCHOR),
    });
    expect(run("cli_peak", "7d", silent)).toEqual([]);
  });
});

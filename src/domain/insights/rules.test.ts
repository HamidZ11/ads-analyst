import { describe, expect, it } from "vitest";
import { conversionVocabulary } from "../labels";
import { snapshot, type DailyPoint } from "../metrics";
import { addDays } from "../periods";
import { briefingSentence, countByPriority, periodPhrase } from "./briefing";
import { formatInsightValue } from "./format";
import type {
  CampaignFacts,
  CreativeFacts,
  EntityFacts,
  Finding,
  InsightContext,
  InsightFacts,
} from "./model";
import {
  cpaTargetRelation,
  dedupeByEntity,
  detectorEnvironment,
  detectCreativeFatigue,
  orderFindings,
  roasTargetRelation,
  runInsightEngine,
  trendSlope,
} from "./rules";

/* Synthetic facts: every test states its numbers, so a finding can only come from them. */

interface T {
  spend: number;
  conversions?: number;
  revenue?: number;
  impressions?: number;
  clicks?: number;
}

const START = "2026-09-20";

function totals(t: T) {
  return {
    spend: t.spend,
    conversions: t.conversions ?? 0,
    revenue: t.revenue ?? 0,
    impressions: t.impressions ?? 0,
    clicks: t.clicks ?? 0,
  };
}

function spread(t: T, days: number, offset: number): DailyPoint[] {
  const x = totals(t);
  return Array.from({ length: days }, (_, i) => ({
    date: addDays(START, offset + i),
    spend: x.spend / days,
    conversions: x.conversions / days,
    revenue: x.revenue / days,
    impressions: x.impressions / days,
    clicks: x.clicks / days,
  }));
}

function entity(
  type: EntityFacts["entity"]["type"],
  id: string,
  current: T,
  previous: T,
  days = 7,
  daily?: { previous: T[]; current: T[] },
): EntityFacts {
  const toPoints = (rows: T[], offset: number) =>
    rows.map((r, i) => ({ date: addDays(START, offset + i), ...totals(r) }));
  const d = daily
    ? { previous: toPoints(daily.previous, 0), current: toPoints(daily.current, days) }
    : { previous: spread(previous, days, 0), current: spread(current, days, days) };
  return {
    entity: { type, id, name: `${type} ${id}`, context: null },
    current: snapshot(daily ? d.current : [totals(current)]),
    previous: snapshot(daily ? d.previous : [totals(previous)]),
    daily: d,
  };
}

function campaign(id: string, current: T, previous: T, ads: EntityFacts[] = []): CampaignFacts {
  return { ...entity("campaign", id, current, previous), status: "active", ads };
}

/** A steady campaign that fires nothing: CPA on the £20 target, no change. */
const steady = (id = "steady", spend = 1000) =>
  campaign(
    id,
    {
      spend,
      conversions: spend / 20,
      revenue: spend * 3,
      impressions: spend * 100,
      clicks: spend * 1.5,
    },
    {
      spend,
      conversions: spend / 20,
      revenue: spend * 3,
      impressions: spend * 100,
      clicks: spend * 1.5,
    },
  );

const CONTEXT: InsightContext = {
  clientName: "Test Co.",
  currency: "GBP",
  vocabulary: conversionVocabulary("ecommerce"),
  targetCpa: 20,
  targetRoas: 3,
  tracksRevenue: true,
  periodDays: 7,
  comparison: "previous 7 days",
};

function facts(
  campaigns: CampaignFacts[],
  options: { creatives?: CreativeFacts[]; context?: Partial<InsightContext> } = {},
): InsightFacts {
  const sum = (side: "current" | "previous"): T => {
    const t = campaigns.map((c) => c[side].totals);
    return {
      spend: t.reduce((s, x) => s + x.spend, 0),
      conversions: t.reduce((s, x) => s + x.conversions, 0),
      revenue: t.reduce((s, x) => s + x.revenue, 0),
      impressions: t.reduce((s, x) => s + x.impressions, 0),
      clicks: t.reduce((s, x) => s + x.clicks, 0),
    };
  };
  return {
    context: { ...CONTEXT, ...options.context },
    account: entity("account", "acct", sum("current"), sum("previous")),
    campaigns,
    creatives: options.creatives ?? [],
  };
}

const only = (findings: Finding[], id: string) => findings.filter((f) => f.entity.id === id);

describe("zero-conversion spend", () => {
  const subject = (current: T, previous: T = { spend: 90 }) =>
    campaign("subject", { impressions: 5000, clicks: 50, ...current }, previous);

  it("fires on meaningful spend with no conversions, as high impact", () => {
    const [f] = only(runInsightEngine(facts([subject({ spend: 100 }), steady()])), "subject");
    expect(f.detector).toBe("zero_conversion_spend");
    expect(f.priority).toBe("high");
    expect(f.headline).toBe("£100 was spent with no purchases.");
    expect(f.evidence.map((e) => [e.label, e.value])).toEqual([
      ["Spend", 100],
      ["Purchases", 0],
      ["Clicks", 50],
    ]);
    expect(f.reason).toContain("at least twice the £20 cost per purchase target");
    expect(f.reason).toContain("the previous period had none either");
    expect(f.chart).toBeNull();
  });

  it("needs spend of at least twice the target cost per conversion", () => {
    const findings = runInsightEngine(
      facts([subject({ spend: 100 }), steady()], { context: { targetCpa: 60 } }),
    );
    expect(only(findings, "subject")).toEqual([]);
  });

  it("does not fire on a single conversion or on immaterial spend", () => {
    expect(
      only(
        runInsightEngine(facts([subject({ spend: 100, conversions: 1 }), steady()])),
        "subject",
      ),
    ).toEqual([]);
    expect(
      only(runInsightEngine(facts([subject({ spend: 45 }), steady()])), "subject"),
    ).toEqual([]);
  });

  it("states the share of spend instead of a target when the client has none", () => {
    const [f] = only(
      runInsightEngine(
        facts([subject({ spend: 100 }), steady()], { context: { targetCpa: null } }),
      ),
      "subject",
    );
    expect(f.reason).toContain("9% of account spend");
    expect(f.target).toBeNull();
  });
});

describe("campaign deterioration", () => {
  const prev: T = { spend: 1000, conversions: 50, revenue: 3000 };

  it("fires when spend rises 10%+ while conversions fall 10%+, with evidence and target", () => {
    const findings = runInsightEngine(
      facts([
        campaign("subject", { spend: 1200, conversions: 40, revenue: 2400 }, prev),
        steady(),
      ]),
    );
    const mine = only(findings, "subject");
    // CPA spike and ROAS decline also hold; one finding per entity keeps the most specific.
    expect(mine).toHaveLength(1);
    const [f] = mine;
    expect(f.detector).toBe("campaign_deterioration");
    expect(f.priority).toBe("high");
    expect(f.headline).toBe("Spend rose 20.0% while purchases fell 20.0%.");
    expect(f.evidence[0]).toMatchObject({ label: "Spend", value: 1200, change: 0.2 });
    expect(f.evidence[1]).toMatchObject({ label: "Purchases", value: 40, change: -0.2 });
    expect(f.evidence[2]).toMatchObject({ value: 30, note: "from £20.00" });
    expect(f.evidence[3]).toMatchObject({
      label: "Target",
      value: 20,
      format: "money",
      note: "£10.00 over",
      noteTone: "negative",
    });
    expect(f.target).toMatchObject({ metric: "cpa", target: 20, actual: 30, relation: "over" });
    expect(f.chart?.current).toHaveLength(7);
    expect(f.chart?.previous).toHaveLength(7);
    expect(f.comparison.map((r) => r.label)).toEqual([
      "Spend",
      "Purchases",
      "Cost per purchase",
      "ROAS",
    ]);
  });

  it("is a watch item when cost per conversion is still within target", () => {
    const [f] = only(
      runInsightEngine(
        facts([campaign("subject", { spend: 1200, conversions: 40 }, prev), steady()], {
          context: { targetCpa: 40, tracksRevenue: false },
        }),
      ),
      "subject",
    );
    expect(f.detector).toBe("campaign_deterioration");
    expect(f.priority).toBe("watch");
  });

  it("does not fire below either threshold", () => {
    const smallSpendRise = only(
      runInsightEngine(
        facts([campaign("subject", { spend: 1090, conversions: 40 }, prev), steady()]),
      ),
      "subject",
    );
    expect(smallSpendRise.map((f) => f.detector)).not.toContain("campaign_deterioration");
    const smallFall = only(
      runInsightEngine(
        facts([campaign("subject", { spend: 1200, conversions: 46 }, prev), steady()]),
      ),
      "subject",
    );
    expect(smallFall.map((f) => f.detector)).not.toContain("campaign_deterioration");
  });

  it("needs five conversions in the previous period and some in the current one", () => {
    expect(
      only(
        runInsightEngine(
          facts([
            campaign(
              "subject",
              { spend: 1200, conversions: 2 },
              { spend: 1000, conversions: 4 },
            ),
            steady(),
          ]),
        ),
        "subject",
      ).map((f) => f.detector),
    ).not.toContain("campaign_deterioration");
    const [f] = only(
      runInsightEngine(
        facts([campaign("subject", { spend: 1200, conversions: 0 }, prev), steady()]),
      ),
      "subject",
    );
    expect(f.detector).toBe("zero_conversion_spend");
  });
});

describe("CPA spike", () => {
  const prev: T = { spend: 1000, conversions: 50 };

  it("fires at a 25% rise with stable spend", () => {
    const [f] = only(
      runInsightEngine(
        facts([campaign("subject", { spend: 1000, conversions: 40 }, prev), steady()]),
      ),
      "subject",
    );
    expect(f.detector).toBe("cpa_spike");
    expect(f.priority).toBe("high");
    expect(f.headline).toBe(
      "Cost per purchase rose 25.0% to £25.00 while spend remained stable.",
    );
    expect(f.key).toEqual({ value: 0.25, format: "change", label: "cost per purchase" });
  });

  it("does not fire below 25%", () => {
    expect(
      only(
        runInsightEngine(
          facts([campaign("subject", { spend: 1000, conversions: 41 }, prev), steady()]),
        ),
        "subject",
      ),
    ).toEqual([]);
  });

  it("is a watch item when still within target, and needs five conversions per period", () => {
    const [watch] = only(
      runInsightEngine(
        facts([campaign("subject", { spend: 1000, conversions: 40 }, prev), steady()], {
          context: { targetCpa: 30 },
        }),
      ),
      "subject",
    );
    expect(watch.priority).toBe("watch");
    expect(watch.reason).toContain("still within the £30 target");
    expect(
      only(
        runInsightEngine(
          facts([
            campaign(
              "subject",
              { spend: 1000, conversions: 4 },
              { spend: 1000, conversions: 8 },
            ),
            steady(),
          ]),
        ),
        "subject",
      ).map((f) => f.detector),
    ).not.toContain("cpa_spike");
  });

  it("names the spend movement truthfully", () => {
    const [f] = only(
      runInsightEngine(
        facts([campaign("subject", { spend: 1080, conversions: 40 }, prev), steady()]),
      ),
      "subject",
    );
    expect(f.headline).toBe("Cost per purchase rose 35.0% to £27.00 as spend rose 8.0%.");
  });
});

describe("ROAS decline", () => {
  const prev: T = { spend: 1000, conversions: 50, revenue: 3000 };

  it("fires on a 20%+ fall and is high impact below the ROAS target", () => {
    const [f] = only(
      runInsightEngine(
        facts([
          campaign("subject", { spend: 1000, conversions: 50, revenue: 2300 }, prev),
          steady(),
        ]),
      ),
      "subject",
    );
    expect(f.detector).toBe("roas_decline");
    expect(f.priority).toBe("high");
    expect(f.headline).toBe("ROAS fell 23.3% to 2.30x, below the 3.00x target.");
    expect(f.target).toMatchObject({ metric: "roas", relation: "under", favourable: false });
  });

  it("never fires for clients that do not track revenue, or without previous revenue", () => {
    const current = campaign("subject", { spend: 1000, conversions: 50, revenue: 2300 }, prev);
    expect(
      only(
        runInsightEngine(facts([current, steady()], { context: { tracksRevenue: false } })),
        "subject",
      ),
    ).toEqual([]);
    expect(
      only(
        runInsightEngine(
          facts([
            campaign(
              "subject",
              { spend: 1000, conversions: 50, revenue: 0 },
              { spend: 1000, conversions: 50 },
            ),
            steady(),
          ]),
        ),
        "subject",
      ),
    ).toEqual([]);
  });
});

describe("CTR deterioration", () => {
  const prev: T = { spend: 1000, conversions: 50, impressions: 100000, clicks: 2000 };

  it("fires on a 15%+ fall in CTR as a watch item", () => {
    const [f] = only(
      runInsightEngine(facts([campaign("subject", { ...prev, clicks: 1600 }, prev), steady()])),
      "subject",
    );
    expect(f.detector).toBe("ctr_deterioration");
    expect(f.priority).toBe("watch");
    expect(f.headline).toBe("CTR fell 20.0% to 1.60% on steady impressions.");
  });

  it("needs 1,000 impressions in each period", () => {
    const low: T = { spend: 1000, conversions: 50, impressions: 900, clicks: 20 };
    expect(
      only(
        runInsightEngine(facts([campaign("subject", { ...low, clicks: 10 }, low), steady()])),
        "subject",
      ),
    ).toEqual([]);
  });
});

describe("creative fatigue proxy", () => {
  const day = (ctr: number, spend = 100, impressions = 10000): T => ({
    spend,
    impressions,
    clicks: impressions * ctr,
    conversions: 2,
  });
  const creative = (previous: T[], current: T[]): CreativeFacts => {
    const sum = (rows: T[]) => ({
      spend: rows.reduce((s, r) => s + r.spend, 0),
      impressions: rows.reduce((s, r) => s + (r.impressions ?? 0), 0),
      clicks: rows.reduce((s, r) => s + (r.clicks ?? 0), 0),
      conversions: rows.reduce((s, r) => s + (r.conversions ?? 0), 0),
    });
    return {
      ...entity("creative", "cr", sum(current), sum(previous), 7, { previous, current }),
      creativeType: "video",
      adCount: 2,
      campaignCount: 1,
    };
  };
  const declining = (from: number) =>
    Array.from({ length: 7 }, (_, i) => day(from - i * 0.0005));
  const base = [steady("a"), steady("b")];

  it("fires when CTR falls 15%+ and trends down on stable CPM and spend", () => {
    const [f] = runInsightEngine(
      facts(base, { creatives: [creative(declining(0.02), declining(0.0165))] }),
    );
    expect(f.detector).toBe("creative_fatigue");
    expect(f.priority).toBe("watch");
    expect(f.headline).toMatch(
      /^This creative shows a fatigue pattern: CTR fell \d+\.\d% while CPM held steady\.$/,
    );
    expect(f.reason).toContain("This is a fatigue proxy, not a measured cause.");
    expect(f.chart?.title).toBe("Daily CTR");
  });

  it("does not fire when CPM or spend moved more than 15%", () => {
    const cpmUp = Array.from({ length: 7 }, (_, i) => day(0.0165 - i * 0.0005, 100, 8000));
    expect(
      runInsightEngine(facts(base, { creatives: [creative(declining(0.02), cpmUp)] })),
    ).toEqual([]);
    const spendUp = Array.from({ length: 7 }, (_, i) => day(0.0165 - i * 0.0005, 120, 12000));
    expect(
      runInsightEngine(facts(base, { creatives: [creative(declining(0.02), spendUp)] })),
    ).toEqual([]);
  });

  it("does not fire on a one-day spike that is not a steady decline", () => {
    const previous = [0.005, 0.005, 0.005, 0.005, 0.005, 0.005, 0.06].map((c) => day(c));
    const current = Array.from({ length: 7 }, () => day(0.01));
    const env = detectorEnvironment(facts(base));
    expect(detectCreativeFatigue(creative(previous, current), env)).toBeNull();
  });

  it("needs at least three days in the period", () => {
    const env = detectorEnvironment(facts(base, { context: { periodDays: 1 } }));
    expect(detectCreativeFatigue(creative(declining(0.02), declining(0.0165)), env)).toBeNull();
  });
});

describe("spend concentration", () => {
  const spends = (values: number[]) => values.map((v, i) => steady(`c${i}`, v));

  it("computes the top-three share across delivering campaigns", () => {
    const [f] = runInsightEngine(facts(spends([250, 200, 150, 50, 50, 50])));
    expect(f.detector).toBe("spend_concentration");
    expect(f.entity.type).toBe("account");
    expect(f.headline).toBe("80% of spend sits in three campaigns.");
    expect(f.evidence[0]).toMatchObject({ label: "Top 3 share", value: 0.8, note: "of £750" });
    expect(f.evidence[1].value).toBeCloseTo(250 / 750, 10);
    expect(f.evidence[2]).toMatchObject({ label: "Delivering campaigns", value: 6 });
    expect(f.breakdown?.rows.map((r) => r.highlight)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
    ]);
    expect(f.spendInvolved).toBe(750);
  });

  it("flags one dominant campaign, and lists the rest beyond six", () => {
    const [single] = runInsightEngine(facts(spends([500, 300, 200])));
    expect(single.headline).toBe("One campaign holds 50% of spend.");
    const [many] = runInsightEngine(facts(spends([400, 300, 200, 40, 30, 30, 20, 20])));
    expect(many.breakdown?.rows).toHaveLength(6);
    expect(many.breakdown?.note).toBe("2 more campaigns hold 4%.");
  });

  it("does not fire when spend is evenly spread or there are too few campaigns", () => {
    expect(runInsightEngine(facts(spends([100, 100, 100, 100, 100])))).toEqual([]);
    expect(runInsightEngine(facts([...spends([300, 250]), steady("idle", 0)]))).toEqual([]);
  });
});

describe("underfunded winner", () => {
  const ad = (id: string, spend: number, conversions: number) =>
    entity(
      "ad",
      id,
      { spend, conversions, revenue: conversions * 60 },
      { spend, conversions, revenue: conversions * 60 },
    );
  const build = (ads: EntityFacts[], context: Partial<InsightContext> = {}) => {
    const sum = ads.reduce(
      (s, a) => ({
        spend: s.spend + a.current.totals.spend,
        conversions: s.conversions + a.current.totals.conversions,
        revenue: s.revenue + a.current.totals.revenue,
      }),
      { spend: 0, conversions: 0, revenue: 0 },
    );
    return runInsightEngine(facts([campaign("camp", sum, sum, ads), steady()], { context }));
  };
  const standard = () => [
    ad("a", 400, 16),
    ad("b", 300, 10),
    ad("c", 200, 8),
    ad("d", 100, 10),
  ];

  it("fires on the cheapest ad with a small share of its campaign's spend", () => {
    const [f] = build(standard());
    expect(f.detector).toBe("underfunded_winner");
    expect(f.entity).toMatchObject({ type: "ad", id: "d" });
    expect(f.priority).toBe("opportunity");
    expect(f.evidence[0]).toMatchObject({ value: 10, note: "campaign £22.73" });
    expect(f.evidence[1]).toMatchObject({ value: 100, note: "10% of campaign" });
    expect(f.breakdown?.rows.map((r) => [r.id, r.highlight])).toEqual([
      ["a", false],
      ["b", false],
      ["c", false],
      ["d", true],
    ]);
  });

  it("does not fire on a large share, a small cost gap, few conversions, few ads or over target", () => {
    expect(
      build([ad("a", 400, 16), ad("b", 300, 10), ad("c", 100, 4), ad("d", 250, 25)]),
    ).toEqual([]);
    expect(
      build([ad("a", 400, 20), ad("b", 300, 15), ad("c", 200, 10), ad("d", 100, 6)]),
    ).toEqual([]);
    expect(
      build([ad("a", 400, 16), ad("b", 300, 10), ad("c", 200, 8), ad("d", 20, 2)]),
    ).toEqual([]);
    expect(build([ad("a", 400, 16), ad("d", 100, 10)])).toEqual([]);
    expect(build(standard(), { targetCpa: 8 })).toEqual([]);
  });
});

describe("positive signals", () => {
  it("flags a scaling winner when spend rises and cost per conversion holds under target", () => {
    const [f] = only(
      runInsightEngine(
        facts(
          [
            campaign(
              "subject",
              { spend: 1150, conversions: 56 },
              { spend: 1000, conversions: 50 },
            ),
            steady(),
          ],
          {
            context: { targetCpa: 25 },
          },
        ),
      ),
      "subject",
    );
    expect(f.detector).toBe("scaling_winner");
    expect(f.headline).toBe(
      "Spend rose 15.0% while cost per purchase stayed £4.46 under target.",
    );
  });

  it("does not call it scaling when cost per conversion rose more than 5% or sits over target", () => {
    const rising = campaign(
      "subject",
      { spend: 1150, conversions: 54 },
      { spend: 1000, conversions: 50 },
    );
    expect(
      only(
        runInsightEngine(facts([rising, steady()], { context: { targetCpa: 25 } })),
        "subject",
      ),
    ).toEqual([]);
    const over = campaign(
      "subject",
      { spend: 1150, conversions: 56 },
      { spend: 1000, conversions: 50 },
    );
    expect(
      only(
        runInsightEngine(facts([over, steady()], { context: { targetCpa: 18 } })),
        "subject",
      ),
    ).toEqual([]);
  });

  it("flags an improving campaign at +25% conversions and −15% cost", () => {
    const [f] = only(
      runInsightEngine(
        facts(
          [
            campaign(
              "subject",
              { spend: 1000, conversions: 50 },
              { spend: 1000, conversions: 40 },
            ),
            steady(),
          ],
          {
            context: { targetCpa: 22 },
          },
        ),
      ),
      "subject",
    );
    expect(f.detector).toBe("campaign_improvement");
    expect(f.headline).toBe("Purchases rose 25.0% while cost per purchase fell 20.0%.");
    expect(
      only(
        runInsightEngine(
          facts(
            [
              campaign(
                "subject",
                { spend: 1000, conversions: 49 },
                { spend: 1000, conversions: 40 },
              ),
              steady(),
            ],
            {
              context: { targetCpa: 22 },
            },
          ),
        ),
        "subject",
      ),
    ).toEqual([]);
  });
});

describe("safeguards", () => {
  it("returns nothing when the account has no spend", () => {
    const empty = campaign("subject", { spend: 0 }, { spend: 0 });
    expect(runInsightEngine(facts([empty]))).toEqual([]);
  });

  it("survives zero denominators and a campaign with no previous period", () => {
    const fresh = campaign("fresh", { spend: 500, conversions: 25 }, { spend: 0 });
    const blank = campaign("blank", { spend: 0 }, { spend: 0 });
    const findings = runInsightEngine(facts([fresh, blank, steady()]));
    expect(
      findings.every((f) =>
        f.evidence.every((e) => e.value === null || Number.isFinite(e.value)),
      ),
    ).toBe(true);
    expect(only(findings, "fresh")).toEqual([]);
  });

  it("keeps one finding per entity and orders by priority, then spend involved", () => {
    const deteriorating = campaign(
      "big",
      { spend: 3000, conversions: 100 },
      { spend: 2500, conversions: 125 },
    );
    const zero = campaign(
      "waste",
      { spend: 400, impressions: 1000, clicks: 10 },
      { spend: 380 },
    );
    const improving = campaign(
      "better",
      { spend: 1000, conversions: 50 },
      { spend: 1000, conversions: 40 },
    );
    const findings = runInsightEngine(
      facts([zero, improving, deteriorating, steady()], { context: { targetCpa: 22 } }),
    );
    expect(findings.map((f) => [f.priority, f.entity.id])).toEqual([
      ["high", "big"],
      ["high", "waste"],
      ["opportunity", "better"],
      // "big" holds 56% of account spend across four delivering campaigns.
      ["watch", "acct"],
    ]);
    expect(new Set(findings.map((f) => f.entity.id)).size).toBe(findings.length);
  });

  it("orders and de-duplicates deterministically", () => {
    const a = {
      priority: "watch",
      detector: "ctr_deterioration",
      entity: { type: "campaign", id: "x" },
      id: "ctr_deterioration:x",
      spendInvolved: 10,
    } as Finding;
    const b = { ...a, priority: "high", detector: "cpa_spike", id: "cpa_spike:x" } as Finding;
    const c = {
      ...a,
      entity: { type: "campaign", id: "y" },
      id: "ctr_deterioration:y",
      spendInvolved: 50,
    } as Finding;
    expect(dedupeByEntity([a, b, c]).map((f) => f.id)).toEqual([
      "cpa_spike:x",
      "ctr_deterioration:y",
    ]);
    expect(orderFindings([a, c, b]).map((f) => f.id)).toEqual([
      "cpa_spike:x",
      "ctr_deterioration:y",
      "ctr_deterioration:x",
    ]);
  });
});

describe("helpers", () => {
  it("relates actuals to targets in the client's favour", () => {
    expect(cpaTargetRelation(30, 20)).toMatchObject({
      relation: "over",
      difference: 10,
      favourable: false,
    });
    expect(cpaTargetRelation(15, 20)).toMatchObject({ relation: "under", favourable: true });
    expect(cpaTargetRelation(20, 20)).toMatchObject({ relation: "on", favourable: true });
    expect(cpaTargetRelation(null, 20)).toBeNull();
    expect(cpaTargetRelation(30, null)).toBeNull();
    expect(roasTargetRelation(2, 3)).toMatchObject({ relation: "under", favourable: false });
    expect(roasTargetRelation(4, 3)).toMatchObject({ relation: "over", favourable: true });
  });

  it("computes a least-squares slope only from four or more readings", () => {
    expect(trendSlope([1, 2, 3])).toBeNull();
    // Gaps keep their day index: points (0,4) (1,3) (3,2) (4,1).
    expect(trendSlope([4, 3, null, 2, 1])).toBeCloseTo(-0.7, 10);
    expect(trendSlope([1, 1, 1, 1])).toBe(0);
  });

  it("formats values for evidence", () => {
    expect(formatInsightValue(1805.4, "money", "GBP")).toBe("£1,805");
    expect(formatInsightValue(138.832, "cost", "GBP")).toBe("£138.83");
    expect(formatInsightValue(0.0087, "percent", "GBP")).toBe("0.87%");
    expect(formatInsightValue(0.653, "share", "GBP")).toBe("65%");
    expect(formatInsightValue(-0.435, "change", "USD")).toBe("−43.5%");
    expect(formatInsightValue(null, "multiple", "USD")).toBe("—");
  });
});

describe("briefing", () => {
  it("builds the sentence from real counts with correct number agreement", () => {
    expect(
      briefingSentence(
        { high: 3, opportunity: 3, watch: 2 },
        "Luxe Skin Co.",
        "in the last 7 days",
      ),
    ).toBe(
      "3 issues need attention, 3 opportunities and 2 things to watch for Luxe Skin Co. in the last 7 days.",
    );
    expect(briefingSentence({ high: 1, opportunity: 1, watch: 1 }, "Arc Cloud", "today")).toBe(
      "1 issue needs attention, 1 opportunity and 1 thing to watch for Arc Cloud today.",
    );
    expect(
      briefingSentence({ high: 0, opportunity: 0, watch: 2 }, "Peak Fitness", "yesterday"),
    ).toBe(
      "Nothing needs attention, no opportunities and 2 things to watch for Peak Fitness yesterday.",
    );
    expect(
      briefingSentence({ high: 0, opportunity: 0, watch: 0 }, "Peak Fitness", "today"),
    ).toBe("No findings for Peak Fitness today.");
  });

  it("counts by priority and phrases the period", () => {
    expect(
      countByPriority([{ priority: "high" }, { priority: "watch" }, { priority: "high" }]),
    ).toEqual({
      high: 2,
      opportunity: 0,
      watch: 1,
    });
    expect(periodPhrase("7d", 7)).toBe("in the last 7 days");
    expect(periodPhrase("30d", 30)).toBe("in the last 30 days");
    expect(periodPhrase("today", 1)).toBe("today");
    expect(periodPhrase("yesterday", 1)).toBe("yesterday");
  });
});

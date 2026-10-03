import { describe, expect, it } from "vitest";
import {
  comparePeriods,
  dailySeries,
  deriveMetrics,
  groupTotalsBy,
  metricChange,
  percentChange,
  safeRatio,
  sumMetrics,
} from "./metrics";
import type { DailyMetrics } from "./types";

function row(
  date: string,
  entityId: string,
  spend: number,
  conversions: number,
  extra: Partial<DailyMetrics> = {},
): DailyMetrics {
  return {
    date,
    entityType: "ad",
    entityId,
    spend,
    revenue: conversions * 50,
    conversions,
    impressions: 1000,
    clicks: 20,
    ...extra,
  };
}

describe("aggregation", () => {
  it("sums additive metrics", () => {
    const totals = sumMetrics([row("2026-10-01", "a", 10, 1), row("2026-10-02", "a", 15.5, 2)]);
    expect(totals).toEqual({
      spend: 25.5,
      revenue: 150,
      conversions: 3,
      impressions: 2000,
      clicks: 40,
    });
  });

  it("derives ratios and returns null for zero denominators", () => {
    const derived = deriveMetrics({
      spend: 100,
      revenue: 350,
      conversions: 4,
      impressions: 10000,
      clicks: 200,
    });
    expect(derived.ctr).toBeCloseTo(0.02);
    expect(derived.cpc).toBeCloseTo(0.5);
    expect(derived.cpm).toBeCloseTo(10);
    expect(derived.cpa).toBeCloseTo(25);
    expect(derived.roas).toBeCloseTo(3.5);
    expect(derived.conversionRate).toBeCloseTo(0.02);

    const empty = deriveMetrics({
      spend: 100,
      revenue: 0,
      conversions: 0,
      impressions: 0,
      clicks: 0,
    });
    expect(empty.cpa).toBeNull();
    expect(empty.ctr).toBeNull();
    expect(empty.roas).toBe(0);
    expect(safeRatio(1, 0)).toBeNull();
  });

  it("groups totals by an arbitrary key", () => {
    const groups = groupTotalsBy(
      [
        row("2026-10-01", "a", 10, 1),
        row("2026-10-01", "b", 5, 0),
        row("2026-10-02", "a", 20, 2),
      ],
      (r) => r.entityId,
    );
    expect(groups.get("a")?.spend).toBe(30);
    expect(groups.get("b")?.conversions).toBe(0);
  });

  it("zero-fills a daily series across the whole range", () => {
    const series = dailySeries([row("2026-10-01", "a", 10, 1)], {
      start: "2026-09-30",
      end: "2026-10-02",
    });
    expect(series.map((p) => p.date)).toEqual(["2026-09-30", "2026-10-01", "2026-10-02"]);
    expect(series.map((p) => p.spend)).toEqual([0, 10, 0]);
  });
});

describe("period comparison", () => {
  it("computes relative change and handles undefined baselines", () => {
    expect(percentChange(110, 100)).toBeCloseTo(0.1);
    expect(percentChange(90, 100)).toBeCloseTo(-0.1);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(null, 100)).toBeNull();
  });

  it("compares current against previous period snapshots", () => {
    const comparison = comparePeriods(
      [row("2026-10-02", "a", 200, 10)],
      [row("2026-09-25", "a", 100, 4)],
    );
    expect(metricChange(comparison, "spend")).toBeCloseTo(1);
    expect(metricChange(comparison, "conversions")).toBeCloseTo(1.5);
    // CPA: 20 vs 25 → -20%
    expect(metricChange(comparison, "cpa")).toBeCloseTo(-0.2);
  });
});

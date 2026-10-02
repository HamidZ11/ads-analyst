import type {
  DailyMetrics,
  DateRange,
  DerivedMetrics,
  IsoDate,
  MetricKey,
  MetricTotals,
} from "./types";
import { eachDay } from "./periods";

export const EMPTY_TOTALS: Readonly<MetricTotals> = Object.freeze({
  spend: 0,
  revenue: 0,
  conversions: 0,
  impressions: 0,
  clicks: 0,
});

export function addTotals(a: MetricTotals, b: MetricTotals): MetricTotals {
  return {
    spend: a.spend + b.spend,
    revenue: a.revenue + b.revenue,
    conversions: a.conversions + b.conversions,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
  };
}

export function sumMetrics(rows: Iterable<MetricTotals>): MetricTotals {
  let totals: MetricTotals = { ...EMPTY_TOTALS };
  for (const row of rows) totals = addTotals(totals, row);
  return totals;
}

/** Division that yields null (not Infinity/NaN) when the denominator is zero. */
export function safeRatio(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;
  if (denominator === 0) return null;
  return numerator / denominator;
}

export function deriveMetrics(t: MetricTotals): DerivedMetrics {
  const cpm = safeRatio(t.spend, t.impressions);
  return {
    ctr: safeRatio(t.clicks, t.impressions),
    cpc: safeRatio(t.spend, t.clicks),
    cpm: cpm === null ? null : cpm * 1000,
    cpa: safeRatio(t.spend, t.conversions),
    roas: safeRatio(t.revenue, t.spend),
    conversionRate: safeRatio(t.conversions, t.clicks),
  };
}

export interface MetricSnapshot {
  totals: MetricTotals;
  derived: DerivedMetrics;
}

export function snapshot(rows: Iterable<MetricTotals>): MetricSnapshot {
  const totals = sumMetrics(rows);
  return { totals, derived: deriveMetrics(totals) };
}

export function metricValue(s: MetricSnapshot, key: MetricKey): number | null {
  return key in s.totals
    ? s.totals[key as keyof MetricTotals]
    : s.derived[key as keyof DerivedMetrics];
}

/** Relative change from `previous` to `current`; null when undefined. */
export function percentChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null) return null;
  if (previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export interface PeriodComparison {
  current: MetricSnapshot;
  previous: MetricSnapshot;
}

export function comparePeriods(
  currentRows: Iterable<MetricTotals>,
  previousRows: Iterable<MetricTotals>,
): PeriodComparison {
  return { current: snapshot(currentRows), previous: snapshot(previousRows) };
}

export function metricChange(c: PeriodComparison, key: MetricKey): number | null {
  return percentChange(metricValue(c.current, key), metricValue(c.previous, key));
}

export function groupTotalsBy<K>(
  rows: Iterable<DailyMetrics>,
  keyOf: (row: DailyMetrics) => K | undefined,
): Map<K, MetricTotals> {
  const groups = new Map<K, MetricTotals>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === undefined) continue;
    groups.set(key, addTotals(groups.get(key) ?? EMPTY_TOTALS, row));
  }
  return groups;
}

export interface DailyPoint extends MetricTotals {
  date: IsoDate;
}

/** Sum rows per day across the whole range, zero-filling days with no rows. */
export function dailySeries(rows: Iterable<DailyMetrics>, range: DateRange): DailyPoint[] {
  const byDate = groupTotalsBy(rows, (r) => r.date);
  return eachDay(range).map((date) => ({ date, ...(byDate.get(date) ?? EMPTY_TOTALS) }));
}

/** Derived metric per day, for sparklines and trend lines. */
export function dailyMetricSeries(
  points: readonly DailyPoint[],
  key: MetricKey,
): (number | null)[] {
  return points.map((p) =>
    key in p ? p[key as keyof MetricTotals] : deriveMetrics(p)[key as keyof DerivedMetrics],
  );
}

export type MetricFormat = "currency" | "count" | "percent" | "multiple";

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  shortLabel: string;
  format: MetricFormat;
  /** Whether an increase is desirable; null when it depends on context (spend). */
  higherIsBetter: boolean | null;
  /** Decimal places when rendered in full (non-compact) form. */
  decimals: number;
}

export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  spend: {
    key: "spend",
    label: "Spend",
    shortLabel: "Spend",
    format: "currency",
    higherIsBetter: null,
    decimals: 0,
  },
  revenue: {
    key: "revenue",
    label: "Revenue",
    shortLabel: "Rev.",
    format: "currency",
    higherIsBetter: true,
    decimals: 0,
  },
  conversions: {
    key: "conversions",
    label: "Conversions",
    shortLabel: "Conv.",
    format: "count",
    higherIsBetter: true,
    decimals: 0,
  },
  impressions: {
    key: "impressions",
    label: "Impressions",
    shortLabel: "Impr.",
    format: "count",
    higherIsBetter: null,
    decimals: 0,
  },
  clicks: {
    key: "clicks",
    label: "Clicks",
    shortLabel: "Clicks",
    format: "count",
    higherIsBetter: null,
    decimals: 0,
  },
  ctr: {
    key: "ctr",
    label: "Click-through rate",
    shortLabel: "CTR",
    format: "percent",
    higherIsBetter: true,
    decimals: 2,
  },
  cpc: {
    key: "cpc",
    label: "Cost per click",
    shortLabel: "CPC",
    format: "currency",
    higherIsBetter: false,
    decimals: 2,
  },
  cpm: {
    key: "cpm",
    label: "Cost per 1,000 impressions",
    shortLabel: "CPM",
    format: "currency",
    higherIsBetter: false,
    decimals: 2,
  },
  cpa: {
    key: "cpa",
    label: "Cost per conversion",
    shortLabel: "CPA",
    format: "currency",
    higherIsBetter: false,
    decimals: 2,
  },
  roas: {
    key: "roas",
    label: "Return on ad spend",
    shortLabel: "ROAS",
    format: "multiple",
    higherIsBetter: true,
    decimals: 2,
  },
  conversionRate: {
    key: "conversionRate",
    label: "Conversion rate",
    shortLabel: "CVR",
    format: "percent",
    higherIsBetter: true,
    decimals: 2,
  },
};

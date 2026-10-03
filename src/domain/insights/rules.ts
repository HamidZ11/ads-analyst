import { CREATIVE_TYPE_LABELS } from "../labels";
import { dailyMetricSeries, percentChange, type MetricSnapshot } from "../metrics";
import type { MetricKey } from "../types";
import { formatInsightValue, formatMagnitude, formatThreshold } from "./format";
import {
  PRIORITY_ORDER,
  type CampaignFacts,
  type ComparisonRow,
  type CreativeFacts,
  type DetectorId,
  type EntityFacts,
  type EvidenceItem,
  type Finding,
  type InsightChart,
  type InsightContext,
  type InsightFacts,
  type InsightPriority,
  type TargetRelation,
  type ValueFormat,
} from "./model";

/**
 * Detector thresholds. Every rule is a comparison of the selected period with
 * the equally long previous period, on stored metrics only. Kept in one place
 * so the "why this was flagged" copy and the tests read the same numbers.
 */
export const INSIGHT_RULES = {
  /** An entity is assessed only when it carries this share of account spend. */
  minSpendShare: 0.05,
  /** Conversions required in each period before a cost or ROAS change is trusted. */
  minConversions: 5,
  /** Changes smaller than this read as "stable" in copy. */
  steady: 0.05,
  /** Charts need at least this many days in the selected period. */
  chartMinDays: 3,
  zeroConversion: { targetMultiple: 2 },
  deterioration: { spendRise: 0.1, conversionFall: 0.1 },
  cpaSpike: { rise: 0.25 },
  roasDecline: { fall: 0.2 },
  ctrDeterioration: { fall: 0.15, minImpressions: 1000 },
  fatigue: {
    ctrFall: 0.15,
    maxCpmChange: 0.15,
    maxSpendChange: 0.15,
    minImpressions: 1000,
    minDays: 3,
  },
  concentration: {
    topCount: 3,
    topShare: 0.6,
    minCampaignsForTop: 6,
    singleShare: 0.4,
    minCampaignsForSingle: 3,
    listed: 6,
  },
  underfunded: { minAds: 3, minConversions: 3, maxSpendShare: 0.2, maxCpaRatio: 0.75 },
  scaling: { spendRise: 0.1, maxCpaRise: 0.05 },
  improvement: { conversionRise: 0.25, cpaFall: 0.15 },
} as const;

const R = INSIGHT_RULES;

/** When two detectors fire on one entity, the earlier one is kept (after priority). */
export const DETECTOR_PRECEDENCE: readonly DetectorId[] = [
  "zero_conversion_spend",
  "campaign_deterioration",
  "cpa_spike",
  "roas_decline",
  "campaign_improvement",
  "scaling_winner",
  "underfunded_winner",
  "ctr_deterioration",
  "creative_fatigue",
  "spend_concentration",
];

/* --------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

export interface DetectorEnv {
  ctx: InsightContext;
  accountSpend: number;
  fmt: (value: number | null, format: ValueFormat) => string;
  /** A target as the client set it: "£28", "£27.50", "3.50x". */
  fmtTarget: (relation: { metric: "cpa" | "roas"; target: number }) => string;
  pluralLower: string;
  singularLower: string;
  costLower: string;
}

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

/** Whether an entity carries enough of the account's spend to be assessed. */
function material(spend: number, env: DetectorEnv): boolean {
  return spend > 0 && share(spend, env.accountSpend) >= R.minSpendShare;
}

function enoughConversions(f: EntityFacts, minimum: number = R.minConversions): boolean {
  return f.current.totals.conversions >= minimum && f.previous.totals.conversions >= minimum;
}

function value(s: MetricSnapshot, key: MetricKey): number | null {
  return key in s.totals
    ? s.totals[key as keyof MetricSnapshot["totals"]]
    : s.derived[key as keyof MetricSnapshot["derived"]];
}

function change(f: EntityFacts, key: MetricKey): number | null {
  return percentChange(value(f.current, key), value(f.previous, key));
}

/** Least-squares slope of the readings that exist; null with fewer than four. */
export function trendSlope(values: readonly (number | null)[]): number | null {
  const points = values
    .map((v, i) => [i, v] as const)
    .filter((p): p is readonly [number, number] => p[1] !== null && Number.isFinite(p[1]));
  if (points.length < 4) return null;
  const meanX = points.reduce((s, p) => s + p[0], 0) / points.length;
  const meanY = points.reduce((s, p) => s + p[1], 0) / points.length;
  const denominator = points.reduce((s, p) => s + (p[0] - meanX) ** 2, 0);
  if (denominator === 0) return null;
  return points.reduce((s, p) => s + (p[0] - meanX) * (p[1] - meanY), 0) / denominator;
}

export function cpaTargetRelation(
  actual: number | null,
  target: number | null,
): TargetRelation | null {
  if (actual === null || !Number.isFinite(actual) || target === null || target <= 0)
    return null;
  const diff = actual - target;
  const relation = Math.abs(diff) < 0.005 ? "on" : diff > 0 ? "over" : "under";
  return {
    metric: "cpa",
    target,
    actual,
    difference: Math.abs(diff),
    relation,
    favourable: relation !== "over",
  };
}

export function roasTargetRelation(
  actual: number | null,
  target: number | null,
): TargetRelation | null {
  if (actual === null || !Number.isFinite(actual) || target === null || target <= 0)
    return null;
  const diff = actual - target;
  const relation = Math.abs(diff) < 0.005 ? "on" : diff > 0 ? "over" : "under";
  return {
    metric: "roas",
    target,
    actual,
    difference: Math.abs(diff),
    relation,
    favourable: relation !== "under",
  };
}

/** "Target £28 · £110.83 over" as an evidence cell. */
function targetEvidence(relation: TargetRelation | null, env: DetectorEnv): EvidenceItem[] {
  if (!relation) return [];
  const format: ValueFormat = relation.metric === "cpa" ? "cost" : "multiple";
  const targetFormat: ValueFormat =
    relation.metric === "roas"
      ? "multiple"
      : Number.isInteger(relation.target)
        ? "money"
        : "cost";
  const words =
    relation.metric === "cpa"
      ? { over: "over", under: "under" }
      : { over: "above", under: "below" };
  return [
    {
      label: "Target",
      value: relation.target,
      format: targetFormat,
      note:
        relation.relation === "on"
          ? "On target"
          : `${env.fmt(relation.difference, format)} ${words[relation.relation]}`,
      noteTone:
        relation.relation === "on" ? "muted" : relation.favourable ? "positive" : "negative",
    },
  ];
}

const COMPARISON: Record<
  | "spend"
  | "revenue"
  | "conversions"
  | "impressions"
  | "clicks"
  | "ctr"
  | "cpm"
  | "cpa"
  | "roas",
  { format: ValueFormat; higherIsBetter: boolean | null }
> = {
  spend: { format: "money", higherIsBetter: null },
  revenue: { format: "money", higherIsBetter: true },
  conversions: { format: "count", higherIsBetter: true },
  impressions: { format: "count", higherIsBetter: null },
  clicks: { format: "count", higherIsBetter: null },
  ctr: { format: "percent", higherIsBetter: true },
  cpm: { format: "cost", higherIsBetter: false },
  cpa: { format: "cost", higherIsBetter: false },
  roas: { format: "multiple", higherIsBetter: true },
};

function comparisonRows(
  f: EntityFacts,
  keys: ReadonlyArray<keyof typeof COMPARISON>,
  env: DetectorEnv,
): ComparisonRow[] {
  const labels: Record<keyof typeof COMPARISON, string> = {
    spend: "Spend",
    revenue: "Revenue",
    conversions: env.ctx.vocabulary.plural,
    impressions: "Impressions",
    clicks: "Clicks",
    ctr: "CTR",
    cpm: "CPM",
    cpa: env.ctx.vocabulary.costLabel,
    roas: "ROAS",
  };
  return keys.map((key) => ({
    label: labels[key],
    format: COMPARISON[key].format,
    current: value(f.current, key),
    previous: value(f.previous, key),
    change: change(f, key),
    higherIsBetter: COMPARISON[key].higherIsBetter,
  }));
}

function chartFor(
  f: EntityFacts,
  key: "conversions" | "spend" | "cpa" | "roas" | "ctr",
  env: DetectorEnv,
): InsightChart | null {
  if (env.ctx.periodDays < R.chartMinDays) return null;
  const current = dailyMetricSeries(f.daily.current, key);
  const previous = dailyMetricSeries(f.daily.previous, key);
  if (!current.some((v) => v !== null)) return null;
  const titles = {
    conversions: `Daily ${env.pluralLower}`,
    spend: "Daily spend",
    cpa: `Daily ${env.costLower}`,
    roas: "Daily ROAS",
    ctr: "Daily CTR",
  };
  const format: ValueFormat =
    key === "conversions"
      ? "count"
      : key === "spend"
        ? "money"
        : key === "cpa"
          ? "cost"
          : key === "roas"
            ? "multiple"
            : "percent";
  const total = key === "conversions" || key === "spend";
  const now = env.fmt(value(f.current, key), format);
  const before = env.fmt(value(f.previous, key), format);
  return {
    title: titles[key],
    format,
    current: f.daily.current.map((p, i) => ({ date: p.date, value: current[i] })),
    previous: f.daily.previous.map((p, i) => ({ date: p.date, value: previous[i] })),
    summary: total
      ? `${titles[key]}: ${now} in total this period against ${before} in the previous period.`
      : `${titles[key]}: ${now} for this period against ${before} in the previous period.`,
  };
}

function finding(
  detector: DetectorId,
  priority: InsightPriority,
  entity: EntityFacts["entity"],
  rest: Omit<Finding, "id" | "detector" | "priority" | "entity">,
): Finding {
  return { id: `${detector}:${entity.id}`, detector, priority, entity, ...rest };
}

/* --------------------------------------------------------------------------
 * Detectors. Each returns a finding or null; none reads a repository.
 * ------------------------------------------------------------------------ */

/** Meaningful spend with no conversions at all in the period. */
export function detectZeroConversionSpend(c: CampaignFacts, env: DetectorEnv): Finding | null {
  const { ctx } = env;
  const spend = c.current.totals.spend;
  if (c.current.totals.conversions > 0 || !material(spend, env)) return null;
  if (ctx.targetCpa !== null && spend < ctx.targetCpa * R.zeroConversion.targetMultiple)
    return null;
  const previousConversions = c.previous.totals.conversions;
  const repeated = c.previous.totals.spend > 0 && previousConversions === 0;
  const basis =
    ctx.targetCpa !== null
      ? `at least twice the ${env.fmtTarget({ metric: "cpa", target: ctx.targetCpa })} ${env.costLower} target`
      : `${env.fmt(share(spend, env.accountSpend), "share")} of account spend`;
  return finding("zero_conversion_spend", "high", c.entity, {
    headline: `${env.fmt(spend, "money")} was spent with no ${env.pluralLower}.`,
    evidence: [
      {
        label: "Spend",
        value: spend,
        format: "money",
        change: change(c, "spend"),
        higherIsBetter: null,
      },
      {
        label: ctx.vocabulary.plural,
        value: 0,
        format: "count",
        note: `${env.fmt(previousConversions, "count")} in the previous period`,
      },
      {
        label: "Clicks",
        value: c.current.totals.clicks,
        format: "count",
        change: change(c, "clicks"),
        higherIsBetter: null,
      },
    ],
    comparison: comparisonRows(c, ["spend", "clicks", "conversions"], env),
    target: null,
    chart: null,
    breakdown: null,
    action: "Confirm conversion tracking, then consider reducing budget.",
    reason: `${env.fmt(spend, "money")} was spent, ${basis}, without a single ${env.singularLower}${repeated ? ", and the previous period had none either" : ""}.`,
    key: { value: spend, format: "money", label: `no ${env.pluralLower}` },
    spendInvolved: spend,
  });
}

/** Spend rising materially while conversions fall materially. */
export function detectCampaignDeterioration(
  c: CampaignFacts,
  env: DetectorEnv,
): Finding | null {
  const { ctx } = env;
  if (!material(c.current.totals.spend, env)) return null;
  // With no conversions at all, the zero-conversion detector owns the entity.
  if (c.previous.totals.conversions < R.minConversions || c.current.totals.conversions === 0)
    return null;
  const spendChange = change(c, "spend");
  const conversionChange = change(c, "conversions");
  if (spendChange === null || conversionChange === null) return null;
  if (spendChange < R.deterioration.spendRise) return null;
  if (conversionChange > -R.deterioration.conversionFall) return null;
  const cpa = c.current.derived.cpa;
  const target = cpaTargetRelation(cpa, ctx.targetCpa);
  const priority: InsightPriority = target?.favourable ? "watch" : "high";
  const targetClause = !target
    ? "."
    : target.relation === "over"
      ? `, leaving ${env.costLower} ${env.fmt(target.difference, "cost")} above the ${env.fmtTarget(target)} target.`
      : `; ${env.costLower} is still within the ${env.fmtTarget(target)} target.`;
  return finding("campaign_deterioration", priority, c.entity, {
    headline: `Spend rose ${formatMagnitude(spendChange)} while ${env.pluralLower} fell ${formatMagnitude(conversionChange)}.`,
    evidence: [
      {
        label: "Spend",
        value: c.current.totals.spend,
        format: "money",
        change: spendChange,
        higherIsBetter: null,
      },
      {
        label: ctx.vocabulary.plural,
        value: c.current.totals.conversions,
        format: "count",
        change: conversionChange,
        higherIsBetter: true,
      },
      {
        label: ctx.vocabulary.costLabel,
        value: cpa,
        format: "cost",
        note: `from ${env.fmt(c.previous.derived.cpa, "cost")}`,
      },
      ...targetEvidence(target, env),
    ],
    comparison: comparisonRows(
      c,
      ctx.tracksRevenue
        ? ["spend", "conversions", "cpa", "roas"]
        : ["spend", "conversions", "cpa"],
      env,
    ),
    target,
    chart: chartFor(c, "conversions", env),
    breakdown: null,
    action:
      priority === "high"
        ? "Review budget allocation and inspect the ads driving the decline."
        : "Inspect the ads behind the decline before adding budget.",
    reason: `Spend rose by more than ${formatThreshold(R.deterioration.spendRise)} while ${env.pluralLower} fell by more than ${formatThreshold(R.deterioration.conversionFall)} against the previous period${targetClause}`,
    key: { value: cpa, format: "cost", label: env.costLower },
    spendInvolved: c.current.totals.spend,
  });
}

/** Cost per conversion rising sharply on enough conversions to trust it. */
export function detectCpaSpike(c: CampaignFacts, env: DetectorEnv): Finding | null {
  const { ctx } = env;
  if (!material(c.current.totals.spend, env) || !enoughConversions(c)) return null;
  const cpa = c.current.derived.cpa;
  const cpaChange = change(c, "cpa");
  if (cpa === null || cpaChange === null || cpaChange < R.cpaSpike.rise) return null;
  const spendChange = change(c, "spend");
  const target = cpaTargetRelation(cpa, ctx.targetCpa);
  const priority: InsightPriority = target?.favourable ? "watch" : "high";
  const spendClause =
    spendChange === null
      ? ""
      : Math.abs(spendChange) < R.steady
        ? " while spend remained stable"
        : spendChange > 0
          ? ` as spend rose ${formatMagnitude(spendChange)}`
          : ` while spend fell ${formatMagnitude(spendChange)}`;
  const targetClause = !target
    ? "."
    : target.relation === "over"
      ? `, and it is ${env.fmt(target.difference, "cost")} above the ${env.fmtTarget(target)} target.`
      : `; it is still within the ${env.fmtTarget(target)} target.`;
  return finding("cpa_spike", priority, c.entity, {
    headline: `${ctx.vocabulary.costLabel} rose ${formatMagnitude(cpaChange)} to ${env.fmt(cpa, "cost")}${spendClause}.`,
    evidence: [
      {
        label: ctx.vocabulary.costLabel,
        value: cpa,
        format: "cost",
        change: cpaChange,
        higherIsBetter: false,
        note: `from ${env.fmt(c.previous.derived.cpa, "cost")}`,
      },
      {
        label: ctx.vocabulary.plural,
        value: c.current.totals.conversions,
        format: "count",
        change: change(c, "conversions"),
        higherIsBetter: true,
      },
      {
        label: "Spend",
        value: c.current.totals.spend,
        format: "money",
        change: spendChange,
        higherIsBetter: null,
      },
      ...targetEvidence(target, env),
    ],
    comparison: comparisonRows(c, ["spend", "conversions", "cpa", "ctr"], env),
    target,
    chart: chartFor(c, "cpa", env),
    breakdown: null,
    action: "Inspect the ads and creatives contributing to the cost increase.",
    reason: `${ctx.vocabulary.costLabel} rose by more than ${formatThreshold(R.cpaSpike.rise)} against the previous period, with at least ${R.minConversions} ${env.pluralLower} in each period${targetClause}`,
    key: { value: cpaChange, format: "change", label: env.costLower },
    spendInvolved: c.current.totals.spend,
  });
}

/** Return on ad spend falling sharply; only for clients that track revenue. */
export function detectRoasDecline(c: CampaignFacts, env: DetectorEnv): Finding | null {
  const { ctx } = env;
  if (!ctx.tracksRevenue || !material(c.current.totals.spend, env)) return null;
  if (c.previous.totals.conversions < R.minConversions || c.previous.totals.revenue <= 0)
    return null;
  const roas = c.current.derived.roas;
  const roasChange = change(c, "roas");
  if (roas === null || roasChange === null || roasChange > -R.roasDecline.fall) return null;
  const target = roasTargetRelation(roas, ctx.targetRoas);
  const priority: InsightPriority = target && !target.favourable ? "high" : "watch";
  return finding("roas_decline", priority, c.entity, {
    headline: `ROAS fell ${formatMagnitude(roasChange)} to ${env.fmt(roas, "multiple")}${target && !target.favourable ? `, below the ${env.fmtTarget(target)} target` : ""}.`,
    evidence: [
      {
        label: "ROAS",
        value: roas,
        format: "multiple",
        change: roasChange,
        higherIsBetter: true,
        note: `from ${env.fmt(c.previous.derived.roas, "multiple")}`,
      },
      {
        label: "Revenue",
        value: c.current.totals.revenue,
        format: "money",
        change: change(c, "revenue"),
        higherIsBetter: true,
      },
      {
        label: "Spend",
        value: c.current.totals.spend,
        format: "money",
        change: change(c, "spend"),
        higherIsBetter: null,
      },
      ...targetEvidence(target, env),
    ],
    comparison: comparisonRows(c, ["spend", "revenue", "roas", "conversions"], env),
    target,
    chart: chartFor(c, "roas", env),
    breakdown: null,
    action: "Inspect which ads lost revenue before adding budget.",
    reason: `ROAS fell by more than ${formatThreshold(R.roasDecline.fall)} against the previous period on at least ${formatThreshold(R.minSpendShare)} of account spend${target ? (target.favourable ? `; it is still at or above the ${env.fmtTarget(target)} target.` : `, and it is ${env.fmt(target.difference, "multiple")} below the ${env.fmtTarget(target)} target.`) : "."}`,
    key: { value: roas, format: "multiple", label: "ROAS" },
    spendInvolved: c.current.totals.spend,
  });
}

/** Campaign click-through rate falling on enough impressions to trust it. */
export function detectCtrDeterioration(c: CampaignFacts, env: DetectorEnv): Finding | null {
  const min = R.ctrDeterioration.minImpressions;
  if (!material(c.current.totals.spend, env)) return null;
  if (c.current.totals.impressions < min || c.previous.totals.impressions < min) return null;
  const ctr = c.current.derived.ctr;
  const ctrChange = change(c, "ctr");
  if (ctr === null || ctrChange === null || ctrChange > -R.ctrDeterioration.fall) return null;
  const impressionChange = change(c, "impressions");
  const clause =
    impressionChange === null
      ? ""
      : Math.abs(impressionChange) < R.steady
        ? " on steady impressions"
        : impressionChange > 0
          ? ` while impressions rose ${formatMagnitude(impressionChange)}`
          : ` as impressions fell ${formatMagnitude(impressionChange)}`;
  return finding("ctr_deterioration", "watch", c.entity, {
    headline: `CTR fell ${formatMagnitude(ctrChange)} to ${env.fmt(ctr, "percent")}${clause}.`,
    evidence: [
      {
        label: "CTR",
        value: ctr,
        format: "percent",
        change: ctrChange,
        higherIsBetter: true,
        note: `from ${env.fmt(c.previous.derived.ctr, "percent")}`,
      },
      {
        label: "Impressions",
        value: c.current.totals.impressions,
        format: "count",
        change: impressionChange,
        higherIsBetter: null,
      },
      {
        label: "Clicks",
        value: c.current.totals.clicks,
        format: "count",
        change: change(c, "clicks"),
        higherIsBetter: null,
      },
    ],
    comparison: comparisonRows(c, ["spend", "impressions", "clicks", "ctr"], env),
    target: null,
    chart: chartFor(c, "ctr", env),
    breakdown: null,
    action: "Review the ads with the steepest CTR decline and consider testing new creative.",
    reason: `Click-through rate fell by more than ${formatThreshold(R.ctrDeterioration.fall)} against the previous period, on at least ${env.fmt(min, "count")} impressions in each period.`,
    key: { value: ctrChange, format: "change", label: "CTR" },
    spendInvolved: c.current.totals.spend,
  });
}

/**
 * A proxy for creative fatigue: CTR falling and trending down day by day
 * while the auction price (CPM) and spend hold. A pattern, never a cause.
 */
export function detectCreativeFatigue(cr: CreativeFacts, env: DetectorEnv): Finding | null {
  const { ctx } = env;
  const F = R.fatigue;
  if (ctx.periodDays < F.minDays || !material(cr.current.totals.spend, env)) return null;
  if (cr.current.totals.impressions < F.minImpressions) return null;
  if (cr.previous.totals.impressions < F.minImpressions) return null;
  const ctrChange = change(cr, "ctr");
  const cpmChange = change(cr, "cpm");
  const spendChange = change(cr, "spend");
  if (ctrChange === null || cpmChange === null || spendChange === null) return null;
  if (ctrChange > -F.ctrFall || Math.abs(cpmChange) > F.maxCpmChange) return null;
  if (Math.abs(spendChange) > F.maxSpendChange) return null;
  const slope = trendSlope([
    ...dailyMetricSeries(cr.daily.previous, "ctr"),
    ...dailyMetricSeries(cr.daily.current, "ctr"),
  ]);
  if (slope === null || slope >= 0) return null;
  const cpmClause =
    Math.abs(cpmChange) < R.steady
      ? "while CPM held steady"
      : `while CPM moved only ${formatMagnitude(cpmChange)}`;
  return finding("creative_fatigue", "watch", cr.entity, {
    headline: `This creative shows a fatigue pattern: CTR fell ${formatMagnitude(ctrChange)} ${cpmClause}.`,
    evidence: [
      {
        label: "CTR",
        value: cr.current.derived.ctr,
        format: "percent",
        change: ctrChange,
        higherIsBetter: true,
        note: `from ${env.fmt(cr.previous.derived.ctr, "percent")}`,
      },
      {
        label: "CPM",
        value: cr.current.derived.cpm,
        format: "cost",
        change: cpmChange,
        higherIsBetter: false,
      },
      {
        label: "Spend",
        value: cr.current.totals.spend,
        format: "money",
        change: spendChange,
        higherIsBetter: null,
      },
    ],
    comparison: comparisonRows(cr, ["spend", "impressions", "cpm", "ctr", "cpa"], env),
    target: null,
    chart: chartFor(cr, "ctr", env),
    breakdown: null,
    action: "Refresh or test a replacement creative.",
    reason: `CTR fell by more than ${formatThreshold(F.ctrFall)} and trended down day by day across both periods, while CPM and spend each moved less than ${formatThreshold(F.maxCpmChange)}. This is a fatigue proxy, not a measured cause.`,
    key: { value: ctrChange, format: "change", label: "CTR" },
    spendInvolved: cr.current.totals.spend,
  });
}

/** Account spend sitting in very few campaigns. */
export function detectSpendConcentration(
  facts: InsightFacts,
  env: DetectorEnv,
): Finding | null {
  const C = R.concentration;
  const delivering = facts.campaigns
    .filter((c) => c.current.totals.spend > 0)
    .sort(
      (a, b) =>
        b.current.totals.spend - a.current.totals.spend ||
        a.entity.id.localeCompare(b.entity.id),
    );
  const total = delivering.reduce((s, c) => s + c.current.totals.spend, 0);
  if (total <= 0) return null;
  const top = delivering.slice(0, C.topCount);
  const topShare = share(
    top.reduce((s, c) => s + c.current.totals.spend, 0),
    total,
  );
  const singleShare = share(delivering[0].current.totals.spend, total);
  const single = delivering.length >= C.minCampaignsForSingle && singleShare >= C.singleShare;
  const several = delivering.length >= C.minCampaignsForTop && topShare >= C.topShare;
  if (!single && !several) return null;
  const highlighted = single ? 1 : C.topCount;
  const listed = delivering.slice(0, C.listed);
  const rest = delivering.slice(C.listed);
  const restSpend = rest.reduce((s, c) => s + c.current.totals.spend, 0);
  const n = delivering.length;
  return finding("spend_concentration", "watch", facts.account.entity, {
    headline: single
      ? `One campaign holds ${env.fmt(singleShare, "share")} of spend.`
      : `${env.fmt(topShare, "share")} of spend sits in three campaigns.`,
    evidence: [
      {
        label: "Top 3 share",
        value: topShare,
        format: "share",
        note: `of ${env.fmt(total, "money")}`,
      },
      {
        label: "Largest campaign",
        value: singleShare,
        format: "share",
        note: env.fmt(delivering[0].current.totals.spend, "money"),
      },
      { label: "Delivering campaigns", value: n, format: "count" },
    ],
    comparison: [],
    target: null,
    chart: null,
    breakdown: {
      title: "Share of spend by campaign",
      columns: [
        { label: "Spend", format: "money" },
        { label: "Share", format: "share" },
      ],
      rows: listed.map((c, i) => ({
        id: c.entity.id,
        label: c.entity.name,
        highlight: i < highlighted,
        values: [c.current.totals.spend, share(c.current.totals.spend, total)],
      })),
      note:
        rest.length > 0
          ? `${rest.length} more ${rest.length === 1 ? "campaign holds" : "campaigns hold"} ${env.fmt(share(restSpend, total), "share")}.`
          : null,
    },
    action: "Monitor concentration before the next budget decision.",
    reason: single
      ? `One campaign holds at least ${formatThreshold(C.singleShare)} of spend across ${n} delivering campaigns, so a change in it moves the account result.`
      : `Three campaigns hold at least ${formatThreshold(C.topShare)} of spend across ${n} delivering campaigns, so a change in any of them moves the account result.`,
    key: {
      value: single ? singleShare : topShare,
      format: "share",
      label: single ? "in one campaign" : "in three campaigns",
    },
    spendInvolved: total,
  });
}

/** The most efficient ad in a campaign receiving a small share of its spend. */
export function detectUnderfundedWinner(c: CampaignFacts, env: DetectorEnv): Finding | null {
  const { ctx } = env;
  const U = R.underfunded;
  const campaignSpend = c.current.totals.spend;
  const campaignCpa = c.current.derived.cpa;
  if (!material(campaignSpend, env) || campaignCpa === null) return null;
  const delivering = c.ads.filter((a) => a.current.totals.spend > 0);
  if (delivering.length < U.minAds) return null;
  const converting = delivering.filter((a) => a.current.derived.cpa !== null);
  if (converting.length === 0) return null;
  const best = [...converting].sort(
    (a, b) =>
      a.current.derived.cpa! - b.current.derived.cpa! || a.entity.id.localeCompare(b.entity.id),
  )[0];
  const cpa = best.current.derived.cpa!;
  const spendShare = share(best.current.totals.spend, campaignSpend);
  if (best.current.totals.conversions < U.minConversions) return null;
  if (cpa > campaignCpa * U.maxCpaRatio || spendShare > U.maxSpendShare) return null;
  const target = cpaTargetRelation(cpa, ctx.targetCpa);
  if (target && !target.favourable) return null;
  const columns: Array<{ label: string; format: ValueFormat }> = [
    { label: "Spend", format: "money" },
    { label: "Share", format: "share" },
    { label: ctx.vocabulary.costLabel, format: "cost" },
  ];
  if (ctx.tracksRevenue) columns.push({ label: "ROAS", format: "multiple" });
  return finding("underfunded_winner", "opportunity", best.entity, {
    headline: `Lowest ${env.costLower} in its campaign at ${env.fmt(cpa, "cost")}, on ${env.fmt(spendShare, "share")} of the campaign's spend.`,
    evidence: [
      {
        label: ctx.vocabulary.costLabel,
        value: cpa,
        format: "cost",
        note: `campaign ${env.fmt(campaignCpa, "cost")}`,
      },
      {
        label: "Spend",
        value: best.current.totals.spend,
        format: "money",
        note: `${env.fmt(spendShare, "share")} of campaign`,
      },
      ctx.tracksRevenue
        ? {
            label: "ROAS",
            value: best.current.derived.roas,
            format: "multiple",
            note: `campaign ${env.fmt(c.current.derived.roas, "multiple")}`,
          }
        : {
            label: ctx.vocabulary.plural,
            value: best.current.totals.conversions,
            format: "count",
            note: `of ${env.fmt(c.current.totals.conversions, "count")} in the campaign`,
          },
    ],
    comparison: [],
    target,
    chart: null,
    breakdown: {
      title: "Ads in this campaign",
      columns,
      rows: [...delivering]
        .sort(
          (a, b) =>
            b.current.totals.spend - a.current.totals.spend ||
            a.entity.id.localeCompare(b.entity.id),
        )
        .map((a) => {
          const values: Array<number | null> = [
            a.current.totals.spend,
            share(a.current.totals.spend, campaignSpend),
            a.current.derived.cpa,
          ];
          if (ctx.tracksRevenue) values.push(a.current.derived.roas);
          return {
            id: a.entity.id,
            label: a.entity.name,
            highlight: a.entity.id === best.entity.id,
            values,
          };
        }),
      note: null,
    },
    action: "Consider shifting more budget toward this ad.",
    reason: `Among the ${delivering.length} delivering ads in this campaign, this ad has the lowest ${env.costLower}, at least ${formatThreshold(1 - U.maxCpaRatio)} below the campaign's ${env.fmt(campaignCpa, "cost")}, on no more than ${formatThreshold(U.maxSpendShare)} of its spend${target ? ` and under the ${env.fmtTarget(target)} target` : ""}.`,
    key: { value: cpa, format: "cost", label: env.costLower },
    spendInvolved: best.current.totals.spend,
  });
}

/** Spend scaling while cost per conversion holds (under target when one exists). */
export function detectScalingWinner(c: CampaignFacts, env: DetectorEnv): Finding | null {
  const { ctx } = env;
  if (!material(c.current.totals.spend, env) || !enoughConversions(c)) return null;
  const spendChange = change(c, "spend");
  const conversionChange = change(c, "conversions");
  const cpaChange = change(c, "cpa");
  const cpa = c.current.derived.cpa;
  if (spendChange === null || conversionChange === null || cpaChange === null || cpa === null)
    return null;
  if (spendChange < R.scaling.spendRise || conversionChange <= 0) return null;
  if (cpaChange > R.scaling.maxCpaRise) return null;
  const target = cpaTargetRelation(cpa, ctx.targetCpa);
  if (target && !target.favourable) return null;
  const evidence: EvidenceItem[] = [
    {
      label: "Spend",
      value: c.current.totals.spend,
      format: "money",
      change: spendChange,
      higherIsBetter: null,
    },
    {
      label: ctx.vocabulary.plural,
      value: c.current.totals.conversions,
      format: "count",
      change: conversionChange,
      higherIsBetter: true,
    },
    {
      label: ctx.vocabulary.costLabel,
      value: cpa,
      format: "cost",
      ...(target
        ? {
            note:
              target.relation === "on"
                ? "On target"
                : `${env.fmt(target.difference, "cost")} under target`,
            noteTone: target.relation === "on" ? ("muted" as const) : ("positive" as const),
          }
        : { change: cpaChange, higherIsBetter: false }),
    },
  ];
  if (ctx.tracksRevenue)
    evidence.push({
      label: "ROAS",
      value: c.current.derived.roas,
      format: "multiple",
      change: change(c, "roas"),
      higherIsBetter: true,
    });
  return finding("scaling_winner", "opportunity", c.entity, {
    headline: target
      ? target.relation === "on"
        ? `Spend rose ${formatMagnitude(spendChange)} while ${env.costLower} held on target.`
        : `Spend rose ${formatMagnitude(spendChange)} while ${env.costLower} stayed ${env.fmt(target.difference, "cost")} under target.`
      : `Spend rose ${formatMagnitude(spendChange)} while ${env.costLower} held at ${env.fmt(cpa, "cost")}.`,
    evidence,
    comparison: comparisonRows(
      c,
      ctx.tracksRevenue
        ? ["spend", "conversions", "cpa", "roas"]
        : ["spend", "conversions", "cpa"],
      env,
    ),
    target,
    chart: chartFor(c, "spend", env),
    breakdown: null,
    action: target
      ? `Consider a further measured budget increase while ${env.costLower} stays under target.`
      : `Consider a further measured budget increase while ${env.costLower} holds.`,
    reason: `Spend rose by more than ${formatThreshold(R.scaling.spendRise)}, ${env.pluralLower} rose with it, and ${env.costLower} rose by no more than ${formatThreshold(R.scaling.maxCpaRise)}${target ? `, staying within the ${env.fmtTarget(target)} target.` : "."}`,
    key: { value: spendChange, format: "change", label: "spend" },
    spendInvolved: c.current.totals.spend,
  });
}

/** Conversions rising sharply while cost per conversion falls. */
export function detectCampaignImprovement(c: CampaignFacts, env: DetectorEnv): Finding | null {
  const { ctx } = env;
  if (!material(c.current.totals.spend, env) || !enoughConversions(c)) return null;
  const conversionChange = change(c, "conversions");
  const cpaChange = change(c, "cpa");
  const cpa = c.current.derived.cpa;
  if (conversionChange === null || cpaChange === null || cpa === null) return null;
  if (conversionChange < R.improvement.conversionRise || cpaChange > -R.improvement.cpaFall)
    return null;
  const target = cpaTargetRelation(cpa, ctx.targetCpa);
  if (target && !target.favourable) return null;
  return finding("campaign_improvement", "opportunity", c.entity, {
    headline: `${ctx.vocabulary.plural} rose ${formatMagnitude(conversionChange)} while ${env.costLower} fell ${formatMagnitude(cpaChange)}.`,
    evidence: [
      {
        label: ctx.vocabulary.plural,
        value: c.current.totals.conversions,
        format: "count",
        change: conversionChange,
        higherIsBetter: true,
      },
      {
        label: ctx.vocabulary.costLabel,
        value: cpa,
        format: "cost",
        change: cpaChange,
        higherIsBetter: false,
        ...(target && target.relation !== "on"
          ? {
              note: `${env.fmt(target.difference, "cost")} under target`,
              noteTone: "positive" as const,
            }
          : {}),
      },
      {
        label: "Spend",
        value: c.current.totals.spend,
        format: "money",
        change: change(c, "spend"),
        higherIsBetter: null,
      },
    ],
    comparison: comparisonRows(
      c,
      ctx.tracksRevenue
        ? ["spend", "conversions", "cpa", "roas"]
        : ["spend", "conversions", "cpa"],
      env,
    ),
    target,
    chart: chartFor(c, "conversions", env),
    breakdown: null,
    action: "Consider increasing budget gradually while efficiency holds.",
    reason: `${ctx.vocabulary.plural} rose by more than ${formatThreshold(R.improvement.conversionRise)} and ${env.costLower} fell by more than ${formatThreshold(R.improvement.cpaFall)} against the previous period${target ? `, and ${env.costLower} is within the ${env.fmtTarget(target)} target.` : "."}`,
    key: { value: conversionChange, format: "change", label: env.pluralLower },
    spendInvolved: c.current.totals.spend,
  });
}

/* --------------------------------------------------------------------------
 * Engine
 * ------------------------------------------------------------------------ */

const CAMPAIGN_DETECTORS = [
  detectZeroConversionSpend,
  detectCampaignDeterioration,
  detectCpaSpike,
  detectRoasDecline,
  detectCtrDeterioration,
  detectScalingWinner,
  detectCampaignImprovement,
] as const;

export function detectorEnvironment(facts: InsightFacts): DetectorEnv {
  const { context } = facts;
  return {
    ctx: context,
    accountSpend: facts.account.current.totals.spend,
    fmt: (v, format) => formatInsightValue(v, format, context.currency),
    fmtTarget: ({ metric, target }) =>
      formatInsightValue(
        target,
        metric === "roas" ? "multiple" : Number.isInteger(target) ? "money" : "cost",
        context.currency,
      ),
    pluralLower: context.vocabulary.plural.toLowerCase(),
    singularLower: context.vocabulary.singular.toLowerCase(),
    costLower: context.vocabulary.costLabel.toLowerCase(),
  };
}

function rank(f: Finding): [number, number] {
  return [PRIORITY_ORDER.indexOf(f.priority), DETECTOR_PRECEDENCE.indexOf(f.detector)];
}

/** One finding per entity: the highest priority, then the most specific detector. */
export function dedupeByEntity(findings: readonly Finding[]): Finding[] {
  const kept = new Map<string, Finding>();
  for (const f of findings) {
    const key = `${f.entity.type}:${f.entity.id}`;
    const existing = kept.get(key);
    if (!existing) {
      kept.set(key, f);
      continue;
    }
    const [p1, d1] = rank(f);
    const [p2, d2] = rank(existing);
    if (p1 < p2 || (p1 === p2 && d1 < d2)) kept.set(key, f);
  }
  return [...kept.values()];
}

/** High impact, then opportunity, then watch; within each, the spend involved, largest first. */
export function orderFindings(findings: readonly Finding[]): Finding[] {
  return [...findings].sort(
    (a, b) =>
      PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority) ||
      b.spendInvolved - a.spendInvolved ||
      a.id.localeCompare(b.id),
  );
}

/** Runs every detector over the facts and returns ordered, de-duplicated findings. */
export function runInsightEngine(facts: InsightFacts): Finding[] {
  const env = detectorEnvironment(facts);
  if (env.accountSpend <= 0) return [];
  const candidates: Finding[] = [];
  const push = (f: Finding | null) => {
    if (f) candidates.push(f);
  };
  for (const campaign of facts.campaigns) {
    for (const detect of CAMPAIGN_DETECTORS) push(detect(campaign, env));
    push(detectUnderfundedWinner(campaign, env));
  }
  for (const creative of facts.creatives) push(detectCreativeFatigue(creative, env));
  push(detectSpendConcentration(facts, env));
  return orderFindings(dedupeByEntity(candidates));
}

export function creativeContext(
  type: CreativeFacts["creativeType"],
  ads: number,
  campaigns: number,
) {
  return `${CREATIVE_TYPE_LABELS[type]} · ${ads} ${ads === 1 ? "ad" : "ads"} · ${campaigns} ${campaigns === 1 ? "campaign" : "campaigns"}`;
}

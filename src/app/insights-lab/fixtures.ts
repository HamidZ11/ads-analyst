import {
  formatChange,
  formatCurrency,
  formatDate,
  formatMetric,
  formatNumber,
  formatPercent,
} from "@/domain/format";
import { conversionVocabulary } from "@/domain/labels";
import {
  dailyMetricSeries,
  dailySeries,
  deriveMetrics,
  percentChange,
  snapshot,
  sumMetrics,
} from "@/domain/metrics";
import { rangeLength } from "@/domain/periods";
import type { DateRange } from "@/domain/types";
import {
  getCampaignRows,
  getCreativeRows,
  type CampaignRow,
} from "@/features/analytics/queries";
import { luxeWorkspace } from "../sidebar-lab/workspace";

/**
 * LAB FIXTURES. The production insight engine (APP 05) is not implemented.
 * Each finding below is computed from the real seeded daily metrics for the
 * scenarios the seed documents, pinned by entity id, so wording and evidence
 * are true for the selected period; only the *selection* of scenarios is
 * fixed. Nothing here ships outside the lab.
 */

export type Priority = "high" | "opportunity" | "watch";

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "High impact",
  opportunity: "Opportunity",
  watch: "Watch",
};

export interface Evidence {
  label: string;
  value: string;
  note?: string;
  change?: number | null;
  higherIsBetter?: boolean | null;
}

export interface ComparisonRow {
  label: string;
  now: string;
  before: string;
  change: number | null;
  higherIsBetter: boolean | null;
}

export interface InsightChart {
  title: string;
  format: "count" | "percent" | "currency";
  dates: string[];
  current: (number | null)[];
  previous: (number | null)[];
}

export interface InsightFixture {
  id: string;
  /** Detector vocabulary from the planned engine. */
  detector: string;
  priority: Priority;
  entity: { kind: "Campaign" | "Ad" | "Creative" | "Account"; name: string; meta?: string };
  headline: string;
  evidence: Evidence[];
  whyFlagged: string;
  action: string;
  /** The one number a compact list leads with. */
  key: { value: string; label: string };
  chart?: InsightChart;
  comparison?: ComparisonRow[];
  /** Share bars for the concentration finding. */
  shares?: Array<{ name: string; share: number }>;
}

/** Seed names read "Objective | Audience | Subject"; lead with the subject, or the audience for retargeting. */
function splitName(name: string): { name: string; meta: string } {
  const parts = name.split(" | ");
  if (parts.length < 2) return { name, meta: "" };
  if (parts[0] === "Retargeting" || parts[0] === "Retention")
    return { name: parts.slice(1).join(" · "), meta: parts[0] };
  return { name: parts[parts.length - 1], meta: parts.slice(0, -1).join(" · ") };
}

export function buildInsightFixtures() {
  const workspace = luxeWorkspace();
  const { repository, client, periods, comparison } = workspace;
  const currency = client.currency;
  const vocab = conversionVocabulary(client.type);
  const target = client.targetCpa;
  const span: DateRange = { start: periods.previous.start, end: periods.current.end };
  const split = rangeLength(periods.previous);
  const campaigns = getCampaignRows(repository, client, periods);
  const creatives = getCreativeRows(repository, client, periods);
  const byId = (id: string) => campaigns.find((r) => r.campaign.id === id)!;
  const money = (n: number | null, d = 0) => formatCurrency(n, currency, { decimals: d });
  const cpaOf = (r: { totals: { spend: number; conversions: number } }) =>
    r.totals.conversions ? r.totals.spend / r.totals.conversions : null;

  function campaignDaily(row: CampaignRow) {
    const adSets = repository.listAdSets(row.campaign.id);
    const ads = adSets.flatMap((s) => repository.listAds(s.id));
    const daily = dailySeries(
      repository.queryMetrics({
        clientId: client.id,
        entityIds: ads.map((a) => a.id),
        range: span,
      }),
      span,
    );
    return {
      dates: daily.map((p) => p.date),
      purchases: daily.map((p) => p.conversions),
      spend: daily.map((p) => p.spend),
    };
  }
  function comparisonFor(row: CampaignRow): ComparisonRow[] {
    const cur = row.current;
    const prev = row.previous;
    const curCpa = cpaOf(cur);
    const prevCpa = cpaOf(prev);
    return [
      {
        label: "Spend",
        now: money(cur.totals.spend),
        before: money(prev.totals.spend),
        change: row.spendChange,
        higherIsBetter: null,
      },
      {
        label: vocab.plural,
        now: formatNumber(cur.totals.conversions),
        before: formatNumber(prev.totals.conversions),
        change: row.conversionsChange,
        higherIsBetter: true,
      },
      {
        label: vocab.costLabel,
        now: formatMetric("cpa", curCpa, currency),
        before: formatMetric("cpa", prevCpa, currency),
        change: percentChange(curCpa, prevCpa),
        higherIsBetter: false,
      },
      {
        label: "ROAS",
        now: formatMetric("roas", cur.derived.roas, currency),
        before: formatMetric("roas", prev.derived.roas, currency),
        change: percentChange(cur.derived.roas, prev.derived.roas),
        higherIsBetter: true,
      },
      {
        label: "CTR",
        now: formatMetric("ctr", cur.derived.ctr, currency),
        before: formatMetric("ctr", prev.derived.ctr, currency),
        change: percentChange(cur.derived.ctr, prev.derived.ctr),
        higherIsBetter: true,
      },
    ];
  }

  const fixtures: InsightFixture[] = [];

  // 1. Campaign deterioration — Autumn Reset Sale (seed pattern F: spend up, outcomes down)
  {
    const row = byId("cmp_luxe_05");
    const n = splitName(row.campaign.name);
    const cpa = cpaOf(row.current);
    const prevCpa = cpaOf(row.previous);
    const d = campaignDaily(row);
    fixtures.push({
      id: "deterioration-autumn",
      detector: "Campaign deterioration",
      priority: "high",
      entity: { kind: "Campaign", name: n.name, meta: n.meta },
      headline: `${n.name} spent ${formatChange(row.spendChange).replace("+", "")} more while ${vocab.plural.toLowerCase()} fell ${formatChange(row.conversionsChange).replace("−", "")}.`,
      evidence: [
        {
          label: "Spend",
          value: money(row.current.totals.spend),
          change: row.spendChange,
          higherIsBetter: null,
        },
        {
          label: vocab.plural,
          value: formatNumber(row.current.totals.conversions),
          change: row.conversionsChange,
          higherIsBetter: true,
        },
        {
          label: vocab.costLabel,
          value: formatMetric("cpa", cpa, currency),
          note: `from ${formatMetric("cpa", prevCpa, currency)}`,
        },
        {
          label: "Target",
          value: money(target),
          note: cpa === null ? undefined : `${money(cpa - target, 2)} over`,
        },
      ],
      whyFlagged: `Spend rose materially while ${vocab.plural.toLowerCase()} fell materially, and ${vocab.costLabel.toLowerCase()} moved further over the ${money(target)} target.`,
      action: "Review budget allocation and inspect the ads driving the decline.",
      key: { value: formatMetric("cpa", cpa, currency), label: vocab.costLabel.toLowerCase() },
      chart: {
        title: `Daily ${vocab.plural.toLowerCase()}`,
        format: "count",
        dates: d.dates.slice(split),
        current: d.purchases.slice(split),
        previous: d.purchases.slice(0, split),
      },
      comparison: comparisonFor(row),
    });
  }

  // 2. Zero-conversion spend — Overnight Repair Cream lookalikes (pattern C)
  {
    const row = byId("cmp_luxe_03");
    const n = splitName(row.campaign.name);
    const d = campaignDaily(row);
    fixtures.push({
      id: "zero-conversion-overnight",
      detector: "Zero-conversion spend",
      priority: "high",
      entity: { kind: "Campaign", name: n.name, meta: n.meta },
      headline: `${money(row.current.totals.spend)} was spent on ${n.name} with no ${vocab.plural.toLowerCase()} in the selected period.`,
      evidence: [
        {
          label: "Spend",
          value: money(row.current.totals.spend),
          change: row.spendChange,
          higherIsBetter: null,
        },
        {
          label: vocab.plural,
          value: "0",
          note: `${row.previous.totals.conversions} in the ${comparison}`,
        },
        {
          label: "CTR",
          value: formatMetric("ctr", row.current.derived.ctr, currency),
          change: percentChange(row.current.derived.ctr, row.previous.derived.ctr),
          higherIsBetter: true,
        },
      ],
      whyFlagged: `Spend above ${money(500)} in the period with zero ${vocab.plural.toLowerCase()}, for the second period in a row.`,
      action:
        "Confirm conversion tracking for this campaign, then consider pausing or reducing its budget.",
      key: {
        value: `0 ${vocab.plural.toLowerCase()}`,
        label: `on ${money(row.current.totals.spend)}`,
      },
      chart: {
        title: "Daily spend",
        format: "currency",
        dates: d.dates.slice(split),
        current: d.spend.slice(split),
        previous: d.spend.slice(0, split),
      },
      comparison: comparisonFor(row),
    });
  }

  // 3. CPA spike — Vitamin C Brightening (campaign carrying the fatigued creative)
  {
    const row = byId("cmp_luxe_02");
    const n = splitName(row.campaign.name);
    const cpa = cpaOf(row.current);
    const prevCpa = cpaOf(row.previous);
    const rise = percentChange(cpa, prevCpa);
    const d = campaignDaily(row);
    fixtures.push({
      id: "cpa-spike-vitamin-c",
      detector: "CPA spike",
      priority: "high",
      entity: { kind: "Campaign", name: n.name, meta: n.meta },
      headline: `${vocab.costLabel} in ${n.name} rose ${formatChange(rise).replace("+", "")} to ${formatMetric("cpa", cpa, currency)}.`,
      evidence: [
        {
          label: vocab.costLabel,
          value: formatMetric("cpa", cpa, currency),
          note: `from ${formatMetric("cpa", prevCpa, currency)}`,
          change: rise,
          higherIsBetter: false,
        },
        {
          label: vocab.plural,
          value: formatNumber(row.current.totals.conversions),
          change: row.conversionsChange,
          higherIsBetter: true,
        },
        {
          label: "Spend",
          value: money(row.current.totals.spend),
          change: row.spendChange,
          higherIsBetter: null,
        },
        {
          label: "Target",
          value: money(target),
          note: cpa === null ? undefined : `${money(cpa - target, 2)} over`,
        },
      ],
      whyFlagged: `${vocab.costLabel} rose materially on stable spend and sits ${cpa === null ? "" : money(cpa - target, 2)} over the ${money(target)} target.`,
      action: "Inspect the ads and creatives in this campaign for the source of the increase.",
      key: { value: formatChange(rise), label: vocab.costLabel.toLowerCase() },
      chart: {
        title: `Daily ${vocab.plural.toLowerCase()}`,
        format: "count",
        dates: d.dates.slice(split),
        current: d.purchases.slice(split),
        previous: d.purchases.slice(0, split),
      },
      comparison: comparisonFor(row),
    });
  }

  // 4. Underfunded winner — Collagen Night Mask testimonial ad (pattern E)
  {
    const row = byId("cmp_luxe_07");
    const n = splitName(row.campaign.name);
    const ads = repository.listAdSets(row.campaign.id).flatMap((s) => repository.listAds(s.id));
    const adStats = ads.map((ad) => {
      const snap = snapshot(
        repository.queryMetrics({
          clientId: client.id,
          entityIds: [ad.id],
          range: periods.current,
        }),
      );
      return {
        ad,
        spend: snap.totals.spend,
        conversions: snap.totals.conversions,
        cpa: snap.derived.cpa,
        roas: snap.derived.roas,
      };
    });
    const campaignSpend = adStats.reduce((s, a) => s + a.spend, 0);
    const winner = adStats.find((a) => a.ad.id === "ad_luxe_07a1") ?? adStats[0];
    const share = campaignSpend ? winner.spend / campaignSpend : 0;
    const campaignCpa = cpaOf(row.current);
    fixtures.push({
      id: "underfunded-collagen",
      detector: "Underfunded winner",
      priority: "opportunity",
      entity: { kind: "Ad", name: winner.ad.name, meta: `${n.name} · ${n.meta}` },
      headline: `${winner.ad.name.split(" – ")[0]} testimonial has the campaign's lowest ${vocab.costLabel.toLowerCase()} on ${formatPercent(share, 0)} of its spend.`,
      evidence: [
        {
          label: "Spend",
          value: money(winner.spend),
          note: `${formatPercent(share, 0)} of campaign`,
        },
        {
          label: vocab.costLabel,
          value: formatMetric("cpa", winner.cpa, currency),
          note: `campaign ${formatMetric("cpa", campaignCpa, currency)}`,
        },
        {
          label: "ROAS",
          value: formatMetric("roas", winner.roas, currency),
          note: `campaign ${formatMetric("roas", row.current.derived.roas, currency)}`,
        },
      ],
      whyFlagged: `This ad has the best ${vocab.costLabel.toLowerCase()} and ROAS among the ${adStats.length} ads in its campaign while receiving a small share of the campaign's spend.`,
      action: "Consider shifting budget toward this ad within the campaign.",
      key: {
        value: formatMetric("cpa", winner.cpa, currency),
        label: `on ${formatPercent(share, 0)} of spend`,
      },
      comparison: adStats
        .sort((a, b) => b.spend - a.spend)
        .map((a) => ({
          label: a.ad.name.split(" – ").slice(0, 2).join(" – "),
          now: money(a.spend),
          before: formatNumber(a.conversions),
          change: null,
          higherIsBetter: null,
          cpa: formatMetric("cpa", a.cpa, currency),
        }))
        .map((r) => ({
          label: r.label,
          now: r.now,
          before: r.cpa,
          change: null,
          higherIsBetter: null,
        })),
    });
  }

  // 5. Recovering retargeting campaign — Cart Abandoners (pattern D)
  {
    const row = byId("cmp_luxe_04");
    const n = splitName(row.campaign.name);
    const cpa = cpaOf(row.current);
    const d = campaignDaily(row);
    fixtures.push({
      id: "recovering-cart",
      detector: "Campaign improvement",
      priority: "opportunity",
      entity: { kind: "Campaign", name: n.name, meta: n.meta },
      headline: `${row.campaign.name.split(" | ")[1]} retargeting more than doubled ${vocab.plural.toLowerCase()} on slightly lower spend.`,
      evidence: [
        {
          label: vocab.plural,
          value: formatNumber(row.current.totals.conversions),
          change: row.conversionsChange,
          higherIsBetter: true,
        },
        {
          label: "Spend",
          value: money(row.current.totals.spend),
          change: row.spendChange,
          higherIsBetter: null,
        },
        {
          label: vocab.costLabel,
          value: formatMetric("cpa", cpa, currency),
          note: cpa === null ? undefined : `${money(target - cpa, 2)} under target`,
        },
      ],
      whyFlagged: `${vocab.plural} rose materially while spend fell, and ${vocab.costLabel.toLowerCase()} is under the ${money(target)} target.`,
      action: "Consider restoring or increasing budget while efficiency holds.",
      key: { value: formatChange(row.conversionsChange), label: vocab.plural.toLowerCase() },
      chart: {
        title: `Daily ${vocab.plural.toLowerCase()}`,
        format: "count",
        dates: d.dates.slice(split),
        current: d.purchases.slice(split),
        previous: d.purchases.slice(0, split),
      },
      comparison: comparisonFor(row),
    });
  }

  // 6. Scaling winner — Retinol Renewal Serum (pattern A)
  {
    const row = byId("cmp_luxe_01");
    const n = splitName(row.campaign.name);
    const cpa = cpaOf(row.current);
    const d = campaignDaily(row);
    fixtures.push({
      id: "scaling-retinol",
      detector: "Scaling winner",
      priority: "opportunity",
      entity: { kind: "Campaign", name: n.name, meta: n.meta },
      headline: `${n.name} absorbed ${formatChange(row.spendChange).replace("+", "")} more spend while holding ${vocab.costLabel.toLowerCase()} under target.`,
      evidence: [
        {
          label: "Spend",
          value: money(row.current.totals.spend),
          change: row.spendChange,
          higherIsBetter: null,
        },
        {
          label: vocab.plural,
          value: formatNumber(row.current.totals.conversions),
          change: row.conversionsChange,
          higherIsBetter: true,
        },
        {
          label: vocab.costLabel,
          value: formatMetric("cpa", cpa, currency),
          note: cpa === null ? undefined : `${money(target - cpa, 2)} under target`,
        },
        {
          label: "ROAS",
          value: formatMetric("roas", row.current.derived.roas, currency),
          change: percentChange(row.current.derived.roas, row.previous.derived.roas),
          higherIsBetter: true,
        },
      ],
      whyFlagged: `Spend rose materially while ${vocab.costLabel.toLowerCase()} stayed under target and ROAS held.`,
      action:
        "Consider a further measured budget increase while cost per purchase stays under target.",
      key: { value: formatMetric("roas", row.current.derived.roas, currency), label: "ROAS" },
      chart: {
        title: "Daily spend",
        format: "currency",
        dates: d.dates.slice(split),
        current: d.spend.slice(split),
        previous: d.spend.slice(0, split),
      },
      comparison: comparisonFor(row),
    });
  }

  // 7. Creative fatigue proxy — Vitamin C UGC Before/After (pattern B)
  {
    const row = creatives.find((r) => r.creative.id === "cr_luxe_05")!;
    const daily = dailySeries(
      repository.queryMetrics({
        clientId: client.id,
        entityIds: row.ads.map((a) => a.id),
        range: span,
      }),
      span,
    );
    const ctr = dailyMetricSeries(daily, "ctr");
    const impressionsChange = percentChange(
      row.current.totals.impressions,
      row.previous.totals.impressions,
    );
    const creativeComparison: ComparisonRow[] = [
      {
        label: "Spend",
        now: money(row.current.totals.spend),
        before: money(row.previous.totals.spend),
        change: row.spendChange,
        higherIsBetter: null,
      },
      {
        label: "Impressions",
        now: formatNumber(row.current.totals.impressions),
        before: formatNumber(row.previous.totals.impressions),
        change: impressionsChange,
        higherIsBetter: null,
      },
      {
        label: "CTR",
        now: formatMetric("ctr", row.current.derived.ctr, currency),
        before: formatMetric("ctr", row.previous.derived.ctr, currency),
        change: row.ctrChange,
        higherIsBetter: true,
      },
      {
        label: vocab.plural,
        now: formatNumber(row.current.totals.conversions),
        before: formatNumber(row.previous.totals.conversions),
        change: percentChange(row.current.totals.conversions, row.previous.totals.conversions),
        higherIsBetter: true,
      },
      {
        label: vocab.costLabel,
        now: formatMetric("cpa", row.current.derived.cpa, currency),
        before: formatMetric("cpa", row.previous.derived.cpa, currency),
        change: row.cpaChange,
        higherIsBetter: false,
      },
    ];
    fixtures.push({
      id: "fatigue-vitamin-c-ugc",
      detector: "Creative fatigue proxy",
      priority: "watch",
      entity: {
        kind: "Creative",
        name: row.creative.name,
        meta: `Video · ${row.ads.length} ads · ${row.campaigns.length} campaign`,
      },
      headline: `${row.creative.name.split(" – ").slice(0, 2).join(" – ")} shows a fatigue pattern: CTR fell ${formatChange(row.ctrChange).replace("−", "")} on stable spend.`,
      evidence: [
        {
          label: "CTR",
          value: formatMetric("ctr", row.current.derived.ctr, currency),
          change: row.ctrChange,
          higherIsBetter: true,
        },
        {
          label: "Spend",
          value: money(row.current.totals.spend),
          change: row.spendChange,
          higherIsBetter: null,
        },
        {
          label: vocab.costLabel,
          value: formatMetric("cpa", row.current.derived.cpa, currency),
          change: row.cpaChange,
          higherIsBetter: false,
        },
      ],
      whyFlagged: `Click-through rate declined period over period while spend${Math.abs(impressionsChange ?? 1) < 0.05 ? " and impressions" : ""} stayed stable. This is a fatigue proxy, not a measured cause.`,
      action: "Refresh or test a replacement creative in this ad set.",
      key: { value: formatChange(row.ctrChange), label: "CTR" },
      chart: {
        title: "Daily CTR",
        format: "percent",
        dates: daily.map((p) => p.date).slice(split),
        current: ctr.slice(split),
        previous: ctr.slice(0, split),
      },
      comparison: creativeComparison,
    });
  }

  // 8. Spend concentration — account level
  {
    const delivering = campaigns
      .filter((r) => r.current.totals.spend > 0)
      .sort((a, b) => b.current.totals.spend - a.current.totals.spend);
    const total = delivering.reduce((s, r) => s + r.current.totals.spend, 0);
    const top = delivering.slice(0, 3);
    const topShare = total ? top.reduce((s, r) => s + r.current.totals.spend, 0) / total : 0;
    fixtures.push({
      id: "concentration",
      detector: "Spend concentration",
      priority: "watch",
      entity: {
        kind: "Account",
        name: `${client.name} · Meta Ads`,
        meta: `${delivering.length} delivering campaigns`,
      },
      headline: `${formatPercent(topShare, 0)} of spend sits in three campaigns.`,
      evidence: [
        { label: "Top 3 share", value: formatPercent(topShare, 0), note: `of ${money(total)}` },
        ...top.map((r) => ({
          label: splitName(r.campaign.name).name,
          value: money(r.current.totals.spend),
          note: formatPercent(total ? r.current.totals.spend / total : 0, 0),
        })),
      ],
      whyFlagged:
        "Three campaigns hold more than 60% of spend, so any change in them moves the account.",
      action: "Monitor dependence on these campaigns before the next budget decision.",
      key: { value: formatPercent(topShare, 0), label: "in 3 campaigns" },
      shares: delivering.map((r) => ({
        name: splitName(r.campaign.name).name,
        share: total ? r.current.totals.spend / total : 0,
      })),
    });
  }

  const counts = {
    high: fixtures.filter((f) => f.priority === "high").length,
    opportunity: fixtures.filter((f) => f.priority === "opportunity").length,
    watch: fixtures.filter((f) => f.priority === "watch").length,
  };

  return {
    workspace,
    client,
    vocab,
    currency,
    comparison,
    periodLabel: `${formatDate(periods.current.start)} – ${formatDate(periods.current.end)}`,
    previousLabel: `${formatDate(periods.previous.start)} – ${formatDate(periods.previous.end)}`,
    fixtures,
    counts,
    sumMetrics,
    deriveMetrics,
  };
}

export type InsightsLab = ReturnType<typeof buildInsightFixtures>;

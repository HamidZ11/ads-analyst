import { getRepository } from "@/data";
import {
  formatChange,
  formatCurrency,
  formatDate,
  formatDateRange,
  formatMultiple,
  formatNumber,
  formatPercent,
} from "@/domain/format";
import { metricChange, metricValue, snapshot } from "@/domain/metrics";
import { periodPairForPreset, rangeLength, todayInTimezone } from "@/domain/periods";
import type { CurrencyCode, MetricKey } from "@/domain/types";
import {
  getAccountStructure,
  getCampaignRows,
  getClientPeriodSummary,
  getCreativeRows,
} from "@/features/analytics/queries";

export type LabKey = "roas" | "spend" | "revenue" | "conversions" | "cpa" | "ctr";

export interface LabMetric {
  key: LabKey;
  label: string;
  short: string;
  value: number;
  prev: number;
  change: number | null;
  higherIsBetter: boolean | null;
  target: number | null;
  cur: number[];
  pre: number[];
  /** Formatted day labels ("26 Sep") for the current and previous periods. */
  dates: string[];
  preDates: string[];
  /** The target as the client wrote it: "3.5x", "£28". */
  targetText: string | null;
  bestIdx: number;
  worstIdx: number;
  avg: number;
  full: (n: number | null) => string;
  tick: (n: number) => string;
}

export interface LabCampaign {
  id: string;
  tier: string;
  name: string;
  active: boolean;
  spend: number;
  spendChange: number | null;
  conv: number;
  convChange: number | null;
  cpa: number | null;
  roas: number | null;
  ctr: number | null;
  revenue: number;
  prevSpend: number;
  prevConv: number;
}

export interface LabMover {
  id: string;
  name: string;
  measure: "Purchases" | "Spend";
  current: number;
  delta: number;
  change: number | null;
  text: string;
  deltaText: string;
}

export function buildLabModel() {
  const repository = getRepository();
  const client = repository.getClient("cli_luxe") ?? repository.listClients()[0];
  const currency: CurrencyCode = client.currency;
  const today = todayInTimezone(client.timezone);
  const periods = periodPairForPreset("14d", today);
  const summary = getClientPeriodSummary(repository, client, periods);
  const split = rangeLength(periods.previous);
  const dates = summary.trend.map((p) => p.date);

  const defs: Record<
    LabKey,
    Pick<LabMetric, "label" | "short" | "higherIsBetter" | "full" | "tick"> & { key: MetricKey }
  > = {
    roas: {
      key: "roas",
      label: "Return on ad spend",
      short: "ROAS",
      higherIsBetter: true,
      full: (n) => formatMultiple(n, 2),
      tick: (n) => formatMultiple(n, Number.isInteger(n) ? 0 : 1),
    },
    spend: {
      key: "spend",
      label: "Spend",
      short: "Spend",
      higherIsBetter: null,
      full: (n) => formatCurrency(n, currency),
      tick: (n) => formatCurrency(n, currency, { compact: true }),
    },
    revenue: {
      key: "revenue",
      label: "Revenue",
      short: "Revenue",
      higherIsBetter: true,
      full: (n) => formatCurrency(n, currency, { compact: true }),
      tick: (n) => formatCurrency(n, currency, { compact: true }),
    },
    conversions: {
      key: "conversions",
      label: "Purchases",
      short: "Purchases",
      higherIsBetter: true,
      full: (n) => formatNumber(n),
      tick: (n) => formatNumber(n),
    },
    cpa: {
      key: "cpa",
      label: "Cost per purchase",
      short: "Cost per purchase",
      higherIsBetter: false,
      full: (n) => formatCurrency(n, currency, { decimals: 2 }),
      tick: (n) => formatCurrency(n, currency),
    },
    ctr: {
      key: "ctr",
      label: "Click-through rate",
      short: "CTR",
      higherIsBetter: true,
      full: (n) => formatPercent(n, 2),
      tick: (n) => formatPercent(n, 1),
    },
  };

  const metrics = {} as Record<LabKey, LabMetric>;
  for (const k of Object.keys(defs) as LabKey[]) {
    const d = defs[k];
    const series = summary.trend.map((p) => metricValue(snapshot([p]), d.key) ?? 0);
    const cur = series.slice(split);
    const pre = series.slice(0, split);
    const goodUp = d.higherIsBetter;
    let best = 0;
    let worst = 0;
    cur.forEach((v, i) => {
      const better = goodUp === false ? v < cur[best] : v > cur[best];
      const worse = goodUp === false ? v > cur[worst] : v < cur[worst];
      if (better) best = i;
      if (worse) worst = i;
    });
    metrics[k] = {
      key: k,
      label: d.label,
      short: d.short,
      higherIsBetter: d.higherIsBetter,
      full: d.full,
      tick: d.tick,
      value: metricValue(summary.comparison.current, d.key) ?? 0,
      prev: metricValue(summary.comparison.previous, d.key) ?? 0,
      change: metricChange(summary.comparison, d.key),
      target:
        k === "roas"
          ? client.targetRoas
          : k === "cpa" && client.targetCpa !== null && client.targetCpa > 0
            ? client.targetCpa
            : null,
      targetText:
        k === "roas" && client.targetRoas !== null
          ? formatMultiple(client.targetRoas, Number.isInteger(client.targetRoas * 10) ? 1 : 2)
          : k === "cpa" && client.targetCpa !== null && client.targetCpa > 0
            ? formatCurrency(client.targetCpa, currency, {
                decimals: Number.isInteger(client.targetCpa) ? 0 : 2,
              })
            : null,
      cur,
      pre,
      dates: dates.slice(split).map((d) => formatDate(d)),
      preDates: dates.slice(0, split).map((d) => formatDate(d)),
      bestIdx: best,
      worstIdx: worst,
      avg: cur.reduce((a, b) => a + b, 0) / (cur.length || 1),
    };
  }

  const rows = getCampaignRows(repository, client, periods);
  const campaigns: LabCampaign[] = rows
    .map((r) => {
      const parts = r.campaign.name.split(" | ");
      return {
        id: r.campaign.id,
        tier: parts[0],
        name: parts.slice(1).join(" · "),
        active: r.campaign.status === "active",
        spend: r.current.totals.spend,
        spendChange: r.spendChange,
        conv: r.current.totals.conversions,
        convChange: r.conversionsChange,
        cpa: r.current.derived.cpa,
        roas: r.current.derived.roas,
        ctr: r.current.derived.ctr,
        revenue: r.current.totals.revenue,
        prevSpend: r.previous.totals.spend,
        prevConv: r.previous.totals.conversions,
      };
    })
    .sort((a, b) => b.spend - a.spend);
  const delivering = campaigns.filter((c) => c.spend > 0);
  const totalSpend = delivering.reduce((s, c) => s + c.spend, 0);

  const movers: LabMover[] = [
    ...delivering
      .map((c) => ({ c, delta: c.conv - c.prevConv }))
      .filter((x) => x.delta !== 0)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3)
      .map(({ c, delta }) => ({
        id: `${c.id}-p`,
        name: c.name,
        measure: "Purchases" as const,
        current: c.conv,
        delta,
        change: c.convChange,
        text: formatNumber(c.conv),
        deltaText: `${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))}`,
      })),
    ...delivering
      .map((c) => ({ c, delta: c.spend - c.prevSpend }))
      .filter((x) => Math.abs(x.delta) >= 1)
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3)
      .map(({ c, delta }) => ({
        id: `${c.id}-s`,
        name: c.name,
        measure: "Spend" as const,
        current: c.spend,
        delta,
        change: c.spendChange,
        text: formatCurrency(c.spend, currency),
        deltaText: `${delta > 0 ? "+" : "−"}${formatCurrency(Math.abs(delta), currency)}`,
      })),
  ];

  const tiers = new Map<string, { spend: number; revenue: number }>();
  for (const c of delivering) {
    const t = tiers.get(c.tier) ?? { spend: 0, revenue: 0 };
    t.spend += c.spend;
    t.revenue += c.revenue;
    tiers.set(c.tier, t);
  }
  const tierRows = [...tiers.entries()]
    .map(([name, t]) => ({
      name,
      spend: t.spend,
      share: totalSpend ? t.spend / totalSpend : 0,
      roas: t.spend ? t.revenue / t.spend : null,
    }))
    .sort((a, b) => b.spend - a.spend);

  const creatives = getCreativeRows(repository, client, periods)
    .filter((r) => r.current.totals.spend >= 100 && r.current.derived.roas !== null)
    .sort((a, b) => (b.current.derived.roas ?? 0) - (a.current.derived.roas ?? 0))
    .slice(0, 4);

  const structure = getAccountStructure(repository, client);
  const account = repository.listAdAccounts(client.id)[0];
  const coverage = repository.getCoverage(client.id);

  return {
    agency: repository.getAgency().name,
    client,
    currency,
    metrics,
    campaigns,
    delivering,
    totalSpend,
    movers,
    tierRows,
    creatives,
    structure,
    accountId: account?.externalId ?? "",
    coverage,
    rangeLabel: formatDateRange(periods.current),
    prevLabel: `${formatDate(periods.previous.start)} – ${formatDate(periods.previous.end)}`,
    curShort: `${formatDate(periods.current.start)} – ${formatDate(periods.current.end)}`,
    fmtMoney: (n: number | null) => formatCurrency(n, currency),
    fmtMoney2: (n: number | null) => formatCurrency(n, currency, { decimals: 2 }),
    fmtChange: (n: number | null) => formatChange(n),
  };
}

export type LabModel = ReturnType<typeof buildLabModel>;

/** Text colour for a change: coloured only when material (5%) and directional. */
export function tone(change: number | null, higherIsBetter: boolean | null): string {
  if (change === null || higherIsBetter === null || Math.abs(change) < 0.05)
    return "text-ink-secondary";
  return change > 0 === higherIsBetter ? "text-positive" : "text-negative";
}

/** Lead delta colouring: any non-zero directional movement. */
export function toneAlways(change: number | null, higherIsBetter: boolean | null): string {
  if (change === null || higherIsBetter === null || Math.abs(change) < 0.0005)
    return "text-ink-secondary";
  return change > 0 === higherIsBetter ? "text-positive" : "text-negative";
}

export { formatDate };

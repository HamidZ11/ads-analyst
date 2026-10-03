import { formatDate } from "@/domain/format";
import {
  CREATIVE_TYPE_LABELS,
  conversionVocabulary,
  tracksRevenue,
  type ConversionVocabulary,
} from "@/domain/labels";
import { dailySeries, deriveMetrics, percentChange, sumMetrics } from "@/domain/metrics";
import { rangeLength } from "@/domain/periods";
import type { CreativeThumbnail, CreativeType, CurrencyCode, DateRange } from "@/domain/types";
import { getCreativeRows } from "@/features/analytics/queries";
import type { ChartPoint } from "@/features/overview/chart-geometry";
import type { Workspace } from "@/features/workspace/server";

export interface CreativeMetrics {
  spend: number;
  conversions: number;
  cpa: number | null;
  roas: number | null;
  cpc: number | null;
  ctr: number | null;
}

export interface CreativeUsage {
  campaign: string;
  ad: string;
  spend: number;
}

/** Everything the board and the inspector show for one creative; serialisable. */
export interface CreativeBoardItem {
  id: string;
  name: string;
  type: CreativeType;
  thumbnail: CreativeThumbnail;
  headline: string;
  adCount: number;
  campaignCount: number;
  usage: CreativeUsage[];
  current: CreativeMetrics;
  previous: CreativeMetrics;
  change: Record<"spend" | "conversions" | "cpa" | "roas" | "ctr", number | null>;
  /** Daily CTR across previous + current periods, for the leader trend. */
  ctrSeries: (number | null)[];
  /** Index at which the current period begins in `ctrSeries`. */
  split: number;
  /** Daily spend for the inspector chart, current and previous periods. */
  spendCurrent: ChartPoint[];
  spendPrevious: ChartPoint[];
}

export interface TypeBreakdown {
  type: CreativeType;
  label: string;
  count: number;
  spend: number;
  share: number;
  conversions: number;
  roas: number | null;
  cpa: number | null;
}

export interface CreativeBoardModel {
  items: CreativeBoardItem[];
  types: TypeBreakdown[];
  currency: CurrencyCode;
  vocabulary: ConversionVocabulary;
  showRoas: boolean;
  targetCpa: number | null;
  comparison: string;
  currentLabel: string;
  previousLabel: string;
  singleDay: boolean;
  campaignCount: number;
}

function metrics(snapshot: {
  totals: { spend: number; conversions: number };
  derived: { cpa: number | null; roas: number | null; cpc: number | null; ctr: number | null };
}): CreativeMetrics {
  return {
    spend: snapshot.totals.spend,
    conversions: snapshot.totals.conversions,
    cpa: snapshot.derived.cpa,
    roas: snapshot.derived.roas,
    cpc: snapshot.derived.cpc,
    ctr: snapshot.derived.ctr,
  };
}

/**
 * The Creatives read model: the production creative rows plus the facts the
 * board and inspector show (daily spend per creative, ad-level usage, type
 * breakdown). Everything is derived from the stored daily metrics; nothing
 * here classifies a creative.
 */
export function buildCreativeBoard(workspace: Workspace): CreativeBoardModel {
  const { repository, client, periods, comparison } = workspace;
  const span: DateRange = { start: periods.previous.start, end: periods.current.end };
  const split = rangeLength(periods.previous);
  const rows = getCreativeRows(repository, client, periods);

  const items: CreativeBoardItem[] = rows.map((row) => {
    const ids = row.ads.map((a) => a.id);
    const daily = dailySeries(
      repository.queryMetrics({ clientId: client.id, entityIds: ids, range: span }),
      span,
    );
    const usage = row.ads
      .map((ad) => {
        const lineage = repository.getAdLineage(ad.id);
        if (!lineage) return null;
        const spend = sumMetrics(
          repository.queryMetrics({
            clientId: client.id,
            entityIds: [ad.id],
            range: periods.current,
          }),
        ).spend;
        return { campaign: lineage.campaign.name, ad: ad.name, spend };
      })
      .filter((u): u is CreativeUsage => u !== null)
      .sort((a, b) => b.spend - a.spend);
    const current = metrics(row.current);
    const previous = metrics(row.previous);
    return {
      id: row.creative.id,
      name: row.creative.name,
      type: row.creative.type,
      thumbnail: row.creative.thumbnail,
      headline: row.creative.headline,
      adCount: row.ads.length,
      campaignCount: row.campaigns.length,
      usage,
      current,
      previous,
      change: {
        spend: row.spendChange,
        conversions: percentChange(current.conversions, previous.conversions),
        cpa: row.cpaChange,
        roas: percentChange(current.roas, previous.roas),
        ctr: row.ctrChange,
      },
      ctrSeries: row.ctrSeries,
      split,
      spendCurrent: daily.slice(split).map((p) => ({ date: p.date, value: p.spend })),
      spendPrevious: daily.slice(0, split).map((p) => ({ date: p.date, value: p.spend })),
    };
  });

  const totalSpend = items.reduce((sum, item) => sum + item.current.spend, 0);
  // Known formats always show (as before). "Format unknown" appears only when a
  // data source could not say; known cells are dropped only when nothing is known,
  // so an import without format data never claims "0 video creatives".
  const known: CreativeType[] = ["image", "video", "carousel"];
  const anyKnown = rows.some((r) => known.includes(r.creative.type));
  const anyUnknown = rows.some((r) => r.creative.type === "unknown");
  const shownTypes: CreativeType[] = [
    ...(anyKnown || !anyUnknown ? known : []),
    ...(anyUnknown ? (["unknown"] as CreativeType[]) : []),
  ];
  const types: TypeBreakdown[] = shownTypes.map((type) => {
    const of = rows.filter((r) => r.creative.type === type);
    const totals = sumMetrics(of.map((r) => r.current.totals));
    const derived = deriveMetrics(totals);
    return {
      type,
      label: CREATIVE_TYPE_LABELS[type],
      count: of.length,
      spend: totals.spend,
      share: totalSpend ? totals.spend / totalSpend : 0,
      conversions: totals.conversions,
      roas: derived.roas,
      cpa: derived.cpa,
    };
  });

  return {
    items,
    types,
    currency: client.currency,
    vocabulary: conversionVocabulary(client.type),
    showRoas: tracksRevenue(client),
    targetCpa: client.targetCpa,
    comparison,
    currentLabel: `${formatDate(periods.current.start)} – ${formatDate(periods.current.end)}`,
    previousLabel: `${formatDate(periods.previous.start)} – ${formatDate(periods.previous.end)}`,
    singleDay: rangeLength(periods.current) === 1,
    campaignCount: new Set(rows.flatMap((r) => r.campaigns.map((c) => c.id))).size,
  };
}

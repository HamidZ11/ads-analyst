import { CREATIVE_TYPE_LABELS, conversionVocabulary, tracksRevenue } from "@/domain/labels";
import { dailySeries, deriveMetrics, percentChange, sumMetrics } from "@/domain/metrics";
import { rangeLength } from "@/domain/periods";
import type { Ad, Campaign, CreativeType, DateRange } from "@/domain/types";
import { getCreativeRows, type CreativeRow } from "@/features/analytics/queries";
import { luxeWorkspace } from "../sidebar-lab/workspace";

export interface LabCreative {
  row: CreativeRow;
  /** Change in conversions between the two periods. */
  conversionsChange: number | null;
  /** Daily spend and conversions across previous + current periods. */
  spendSeries: number[];
  conversionSeries: number[];
  /** Index in the series at which the current period begins. */
  split: number;
  /** Spend per ad using this creative, with the campaign it runs in. */
  adSpend: Array<{ ad: Ad; campaign: Campaign; spend: number }>;
  /** Cost per conversion above the client's target; null without a reading. */
  overTarget: boolean | null;
}

export interface TypeFact {
  type: CreativeType;
  label: string;
  count: number;
  spend: number;
  share: number;
  conversions: number;
  roas: number | null;
  cpa: number | null;
}

/**
 * One read model for all three concepts: the production creative rows for the
 * fixed Luxe Skin Co. workspace plus facts derived from the same metrics
 * (daily series, ad-level spend, target position, type breakdown).
 */
export function buildCreativesLab() {
  const workspace = luxeWorkspace();
  const { repository, client, periods, comparison } = workspace;
  const span: DateRange = { start: periods.previous.start, end: periods.current.end };
  const split = rangeLength(periods.previous);
  const rows = getCreativeRows(repository, client, periods).sort(
    (a, b) => b.current.totals.spend - a.current.totals.spend,
  );
  const creatives: LabCreative[] = rows.map((row) => {
    const ids = row.ads.map((a) => a.id);
    const daily = dailySeries(
      repository.queryMetrics({ clientId: client.id, entityIds: ids, range: span }),
      span,
    );
    const adSpend = row.ads
      .map((ad) => {
        const lineage = repository.getAdLineage(ad.id);
        const spend = sumMetrics(
          repository.queryMetrics({
            clientId: client.id,
            entityIds: [ad.id],
            range: periods.current,
          }),
        ).spend;
        return lineage ? { ad, campaign: lineage.campaign, spend } : null;
      })
      .filter((x): x is { ad: Ad; campaign: Campaign; spend: number } => x !== null)
      .sort((a, b) => b.spend - a.spend);
    const cpa = row.current.derived.cpa;
    return {
      row,
      conversionsChange: percentChange(
        row.current.totals.conversions,
        row.previous.totals.conversions,
      ),
      spendSeries: daily.map((p) => p.spend),
      conversionSeries: daily.map((p) => p.conversions),
      split,
      adSpend,
      overTarget: cpa === null || client.targetCpa <= 0 ? null : cpa > client.targetCpa,
    };
  });

  const totals = sumMetrics(rows.map((r) => r.current.totals));
  const previousTotals = sumMetrics(rows.map((r) => r.previous.totals));
  const types: TypeFact[] = (["image", "video", "carousel"] as CreativeType[]).map((type) => {
    const of = rows.filter((r) => r.creative.type === type);
    const t = sumMetrics(of.map((r) => r.current.totals));
    const d = deriveMetrics(t);
    return {
      type,
      label: CREATIVE_TYPE_LABELS[type],
      count: of.length,
      spend: t.spend,
      share: totals.spend ? t.spend / totals.spend : 0,
      conversions: t.conversions,
      roas: d.roas,
      cpa: d.cpa,
    };
  });

  return {
    workspace,
    client,
    comparison,
    rows,
    creatives,
    delivering: creatives.filter((c) => c.row.current.totals.spend > 0),
    totals,
    derived: deriveMetrics(totals),
    previousTotals,
    types,
    vocabulary: conversionVocabulary(client.type),
    showRoas: tracksRevenue(client),
    campaignCount: new Set(rows.flatMap((r) => r.campaigns.map((c) => c.id))).size,
  };
}

export type CreativesLab = ReturnType<typeof buildCreativesLab>;

/** Serialisable slice of a creative for the client-rendered split view. */
export interface SplitCreative {
  id: string;
  name: string;
  type: CreativeType;
  thumbnail: CreativeRow["creative"]["thumbnail"];
  headline: string;
  adCount: number;
  campaignCount: number;
  spend: number;
  previousSpend: number;
  conversions: number;
  previousConversions: number;
  cpa: number | null;
  previousCpa: number | null;
  roas: number | null;
  previousRoas: number | null;
  ctr: number | null;
  previousCtr: number | null;
  spendSeries: number[];
  conversionSeries: number[];
  split: number;
  usage: Array<{ campaign: string; ad: string; spend: number }>;
}

export function toSplitCreative(c: LabCreative): SplitCreative {
  const { row } = c;
  return {
    id: row.creative.id,
    name: row.creative.name,
    type: row.creative.type,
    thumbnail: row.creative.thumbnail,
    headline: row.creative.headline,
    adCount: row.ads.length,
    campaignCount: row.campaigns.length,
    spend: row.current.totals.spend,
    previousSpend: row.previous.totals.spend,
    conversions: row.current.totals.conversions,
    previousConversions: row.previous.totals.conversions,
    cpa: row.current.derived.cpa,
    previousCpa: row.previous.derived.cpa,
    roas: row.current.derived.roas,
    previousRoas: row.previous.derived.roas,
    ctr: row.current.derived.ctr,
    previousCtr: row.previous.derived.ctr,
    spendSeries: c.spendSeries,
    conversionSeries: c.conversionSeries,
    split: c.split,
    usage: c.adSpend.map((x) => ({ campaign: x.campaign.name, ad: x.ad.name, spend: x.spend })),
  };
}

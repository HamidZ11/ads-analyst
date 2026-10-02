import type { AdAnalystRepository } from "@/data";
import {
  comparePeriods,
  dailySeries,
  metricChange,
  metricValue,
  snapshot,
  type DailyPoint,
  type MetricSnapshot,
  type PeriodComparison,
} from "@/domain/metrics";
import { rangeForPreset, type PeriodPair } from "@/domain/periods";
import type {
  Ad,
  AdSet,
  Campaign,
  Client,
  Creative,
  DailyMetrics,
  DateRange,
  MetricKey,
} from "@/domain/types";

/**
 * Read-model queries used by the page shells. They compose the repository and
 * the pure metric utilities; nothing here renders UI or stores derived values.
 */

export interface ClientPeriodSummary {
  comparison: PeriodComparison;
  /** Daily totals across current + previous periods, in date order. */
  trend: DailyPoint[];
}

export function getClientPeriodSummary(
  repository: AdAnalystRepository,
  client: Client,
  periods: PeriodPair,
): ClientPeriodSummary {
  const span: DateRange = { start: periods.previous.start, end: periods.current.end };
  const rows = repository.queryMetrics({ clientId: client.id, range: span });
  const currentRows = rows.filter((r) => r.date >= periods.current.start);
  const previousRows = rows.filter((r) => r.date < periods.current.start);
  return {
    comparison: comparePeriods(currentRows, previousRows),
    trend: dailySeries(rows, span),
  };
}

export interface KpiReading {
  key: MetricKey;
  current: number | null;
  previous: number | null;
  change: number | null;
  /** Per-day values across previous + current periods, for sparklines. */
  series: (number | null)[];
}

export function getKpiReadings(
  summary: ClientPeriodSummary,
  keys: readonly MetricKey[],
): KpiReading[] {
  return keys.map((key) => ({
    key,
    current: metricValue(summary.comparison.current, key),
    previous: metricValue(summary.comparison.previous, key),
    change: metricChange(summary.comparison, key),
    series: summary.trend.map((point) => metricValue(snapshot([point]), key)),
  }));
}

/** Daily client totals over a trailing window (for the overview trend frame). */
export function getTrailingSeries(
  repository: AdAnalystRepository,
  client: Client,
  anchor: string,
  days: 30 | 14 | 7,
): DailyPoint[] {
  const preset = days === 30 ? "30d" : days === 14 ? "14d" : "7d";
  const range = rangeForPreset(preset, anchor);
  return dailySeries(repository.queryMetrics({ clientId: client.id, range }), range);
}

export interface CampaignRow {
  campaign: Campaign;
  adSetCount: number;
  adCount: number;
  current: MetricSnapshot;
  previous: MetricSnapshot;
  spendChange: number | null;
  conversionsChange: number | null;
  cpaChange: number | null;
}

function splitRows(rows: DailyMetrics[], periods: PeriodPair) {
  const current: DailyMetrics[] = [];
  const previous: DailyMetrics[] = [];
  for (const row of rows) {
    if (row.date >= periods.current.start) current.push(row);
    else if (row.date >= periods.previous.start) previous.push(row);
  }
  return { current, previous };
}

export function getCampaignRows(
  repository: AdAnalystRepository,
  client: Client,
  periods: PeriodPair,
): CampaignRow[] {
  const span: DateRange = { start: periods.previous.start, end: periods.current.end };
  return repository.listCampaigns(client.id).map((campaign) => {
    const adSets = repository.listAdSets(campaign.id);
    const ads = adSets.flatMap((s) => repository.listAds(s.id));
    const rows = repository.queryMetrics({
      clientId: client.id,
      entityIds: ads.map((a) => a.id),
      range: span,
    });
    const { current, previous } = splitRows(rows, periods);
    const comparison = comparePeriods(current, previous);
    return {
      campaign,
      adSetCount: adSets.length,
      adCount: ads.length,
      current: comparison.current,
      previous: comparison.previous,
      spendChange: metricChange(comparison, "spend"),
      conversionsChange: metricChange(comparison, "conversions"),
      cpaChange: metricChange(comparison, "cpa"),
    };
  });
}

export interface CreativeRow {
  creative: Creative;
  ads: Ad[];
  adSets: AdSet[];
  campaigns: Campaign[];
  current: MetricSnapshot;
  previous: MetricSnapshot;
  spendChange: number | null;
  ctrChange: number | null;
  cpaChange: number | null;
  /** Daily CTR across previous + current periods. */
  ctrSeries: (number | null)[];
}

export function getCreativeRows(
  repository: AdAnalystRepository,
  client: Client,
  periods: PeriodPair,
): CreativeRow[] {
  const span: DateRange = { start: periods.previous.start, end: periods.current.end };
  const adsByCreative = new Map<string, Ad[]>();
  for (const ad of repository.listAdsForClient(client.id)) {
    const list = adsByCreative.get(ad.creativeId) ?? [];
    list.push(ad);
    adsByCreative.set(ad.creativeId, list);
  }

  return repository.listCreatives(client.id).map((creative) => {
    const ads = adsByCreative.get(creative.id) ?? [];
    const lineages = ads
      .map((ad) => repository.getAdLineage(ad.id))
      .filter((l) => l !== undefined);
    const adSets = [...new Map(lineages.map((l) => [l.adSet.id, l.adSet])).values()];
    const campaigns = [...new Map(lineages.map((l) => [l.campaign.id, l.campaign])).values()];
    const rows = repository.queryMetrics({
      clientId: client.id,
      entityIds: ads.map((a) => a.id),
      range: span,
    });
    const { current, previous } = splitRows(rows, periods);
    const comparison = comparePeriods(current, previous);
    const trend = dailySeries(rows, span);
    return {
      creative,
      ads,
      adSets,
      campaigns,
      current: comparison.current,
      previous: comparison.previous,
      spendChange: metricChange(comparison, "spend"),
      ctrChange: metricChange(comparison, "ctr"),
      cpaChange: metricChange(comparison, "cpa"),
      ctrSeries: trend.map((point) => metricValue(snapshot([point]), "ctr")),
    };
  });
}

export interface AccountStructure {
  campaigns: { total: number; active: number; paused: number };
  adSets: number;
  ads: number;
  creatives: number;
}

export function getAccountStructure(
  repository: AdAnalystRepository,
  client: Client,
): AccountStructure {
  const campaigns = repository.listCampaigns(client.id);
  return {
    campaigns: {
      total: campaigns.length,
      active: campaigns.filter((c) => c.status === "active").length,
      paused: campaigns.filter((c) => c.status === "paused").length,
    },
    adSets: repository.listAdSetsForClient(client.id).length,
    ads: repository.listAdsForClient(client.id).length,
    creatives: repository.listCreatives(client.id).length,
  };
}

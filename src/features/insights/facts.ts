import type { AdAnalystRepository } from "@/data";
import { conversionVocabulary, tracksRevenue } from "@/domain/labels";
import {
  creativeContext,
  type CampaignFacts,
  type CreativeFacts,
  type EntityFacts,
  type InsightEntity,
  type InsightFacts,
} from "@/domain/insights";
import { dailySeries, snapshot } from "@/domain/metrics";
import { comparisonLabel, rangeLength, type PeriodPair } from "@/domain/periods";
import type { Client, DailyMetrics, DateRange } from "@/domain/types";

/**
 * Reads the repository once for the selected client and period pair and
 * produces the source-agnostic facts the insight engine runs on. Only rows
 * inside the two periods are read; only this client's entities are visited.
 */
export function collectInsightFacts(
  repository: AdAnalystRepository,
  client: Client,
  periods: PeriodPair,
): InsightFacts {
  const span: DateRange = { start: periods.previous.start, end: periods.current.end };
  const split = rangeLength(periods.previous);
  const rows = repository.queryMetrics({ clientId: client.id, range: span });
  const byAd = new Map<string, DailyMetrics[]>();
  for (const row of rows) {
    const list = byAd.get(row.entityId) ?? [];
    list.push(row);
    byAd.set(row.entityId, list);
  }

  const factsFor = (entity: InsightEntity, adIds: readonly string[]): EntityFacts => {
    const entityRows = adIds.flatMap((id) => byAd.get(id) ?? []);
    const daily = dailySeries(entityRows, span);
    return {
      entity,
      current: snapshot(entityRows.filter((r) => r.date >= periods.current.start)),
      previous: snapshot(entityRows.filter((r) => r.date < periods.current.start)),
      daily: { previous: daily.slice(0, split), current: daily.slice(split) },
    };
  };

  const adAccount = repository.listAdAccounts(client.id)[0];
  const allAds = repository.listAdsForClient(client.id);

  const campaigns: CampaignFacts[] = repository.listCampaigns(client.id).map((campaign) => {
    const ads = repository.listAdSets(campaign.id).flatMap((s) => repository.listAds(s.id));
    return {
      ...factsFor(
        { type: "campaign", id: campaign.id, name: campaign.name, context: null },
        ads.map((a) => a.id),
      ),
      status: campaign.status,
      ads: ads.map((ad) =>
        factsFor({ type: "ad", id: ad.id, name: ad.name, context: campaign.name }, [ad.id]),
      ),
    };
  });

  const creatives: CreativeFacts[] = repository.listCreatives(client.id).map((creative) => {
    const ads = allAds.filter((a) => a.creativeId === creative.id);
    const campaignIds = new Set(
      ads.map((a) => repository.getAdLineage(a.id)?.campaign.id).filter(Boolean),
    );
    return {
      ...factsFor(
        {
          type: "creative",
          id: creative.id,
          name: creative.name,
          context: creativeContext(creative.type, ads.length, campaignIds.size),
        },
        ads.map((a) => a.id),
      ),
      creativeType: creative.type,
      adCount: ads.length,
      campaignCount: campaignIds.size,
    };
  });

  return {
    context: {
      clientName: client.name,
      currency: client.currency,
      vocabulary: conversionVocabulary(client.type),
      targetCpa: client.targetCpa > 0 ? client.targetCpa : null,
      targetRoas:
        client.targetRoas !== null && client.targetRoas > 0 ? client.targetRoas : null,
      tracksRevenue: tracksRevenue(client),
      periodDays: rangeLength(periods.current),
      comparison: comparisonLabel(periods),
    },
    account: factsFor(
      {
        type: "account",
        id: adAccount?.id ?? client.id,
        name: adAccount?.name ?? client.name,
        context: null,
      },
      allAds.map((a) => a.id),
    ),
    campaigns,
    creatives,
  };
}

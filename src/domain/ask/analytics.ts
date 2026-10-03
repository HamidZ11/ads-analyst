import type { CampaignFacts, EntityFacts, InsightEntity } from "../insights";
import { dailySeries, snapshot } from "../metrics";
import type { DateRange } from "../types";

/** Sum the ads' additive metrics before deriving ratios; never average CPAs. */
export function campaignCreativeFacts(
  campaign: CampaignFacts,
  creatives: InsightEntity[],
  links: Array<{ adId: string; creativeId: string }>,
  periods: { current: DateRange; previous: DateRange },
): EntityFacts[] {
  return creatives
    .flatMap((entity) => {
      const ids = new Set(
        links.filter((link) => link.creativeId === entity.id).map((link) => link.adId),
      );
      const ads = campaign.ads.filter((ad) => ids.has(ad.entity.id));
      if (!ads.length) return [];
      const series = (period: "current" | "previous") =>
        dailySeries(
          ads.flatMap((ad) =>
            ad.daily[period].map((point) => ({
              ...point,
              entityId: ad.entity.id,
              entityType: "ad" as const,
            })),
          ),
          periods[period],
        );
      return [
        {
          entity: { ...entity, context: campaign.entity.name },
          current: snapshot(ads.map((ad) => ad.current.totals)),
          previous: snapshot(ads.map((ad) => ad.previous.totals)),
          daily: { current: series("current"), previous: series("previous") },
        },
      ];
    })
    .sort((a, b) => b.current.totals.spend - a.current.totals.spend);
}

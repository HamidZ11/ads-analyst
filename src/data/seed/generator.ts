import type {
  Ad,
  AdSet,
  Agency,
  Campaign,
  DailyMetrics,
  Dataset,
  IsoDate,
} from "@/domain/types";
import { addDays, dayOfWeek } from "@/domain/periods";
import { createRandom, hashSeed } from "./random";
import { curveAt, type AdSeedSpec, type ClientSeedSpec } from "./spec";

export interface GeneratorOptions {
  /** Most recent seeded day (inclusive). */
  anchorDate: IsoDate;
  /** Number of seeded days ending at the anchor. */
  days: number;
}

export const SEED_DAYS = 60;

interface NoiseProfile {
  spend: number;
  cpm: number;
  ctr: number;
  cvr: number;
  orderValue: number;
}

const NOISE: NoiseProfile = {
  spend: 0.07,
  cpm: 0.06,
  ctr: 0.08,
  cvr: 0.1,
  orderValue: 0.18,
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function generateAdMetrics(
  ad: AdSeedSpec,
  options: GeneratorOptions,
  weekly: ClientSeedSpec["weeklyConversionPattern"],
): DailyMetrics[] {
  const rng = createRandom(hashSeed(ad.id));
  const [firstActive, lastActive] = ad.activeDays ?? [0, options.days - 1];
  const rows: DailyMetrics[] = [];
  const firstDate = addDays(options.anchorDate, -(options.days - 1));

  for (let day = 0; day < options.days; day++) {
    // Keep the PRNG stream aligned to the day index so trimming an ad's active
    // window never reshuffles the other days.
    const spendJitter = rng.jitter(NOISE.spend);
    const cpmJitter = rng.jitter(NOISE.cpm);
    const ctrJitter = rng.jitter(NOISE.ctr);
    const cvrJitter = rng.jitter(NOISE.cvr);
    if (day < firstActive || day > lastActive) continue;

    const date = addDays(firstDate, day);
    const spend = Math.max(0, curveAt(ad.spend, day) * spendJitter);
    const cpm = Math.max(0.5, curveAt(ad.cpm, day) * cpmJitter);
    const impressions = Math.round((spend / cpm) * 1000);
    const ctr = Math.max(0, curveAt(ad.ctr, day) * ctrJitter);
    const clicks = Math.min(impressions, rng.poisson(impressions * ctr));
    const cvr = Math.max(0, curveAt(ad.cvr, day) * cvrJitter * weekly[dayOfWeek(date)]);
    const conversions = Math.min(clicks, rng.poisson(clicks * cvr));
    const aov = curveAt(ad.aov, day);
    let revenue = 0;
    for (let i = 0; i < conversions; i++) revenue += aov * rng.jitter(NOISE.orderValue);

    rows.push({
      date,
      entityType: "ad",
      entityId: ad.id,
      spend: round2(spend),
      revenue: round2(revenue),
      conversions,
      impressions,
      clicks,
    });
  }
  return rows;
}

export function buildDataset(
  agency: Agency,
  clientSpecs: readonly ClientSeedSpec[],
  options: GeneratorOptions,
): Dataset {
  const dataset: Dataset = {
    agency,
    clients: [],
    adAccounts: [],
    campaigns: [],
    adSets: [],
    ads: [],
    creatives: [],
    dailyMetrics: [],
  };

  for (const spec of clientSpecs) {
    dataset.clients.push(spec.client);
    dataset.adAccounts.push(spec.adAccount);
    dataset.creatives.push(...spec.creatives);

    for (const campaignSpec of spec.campaigns) {
      const campaign: Campaign = {
        id: campaignSpec.id,
        adAccountId: spec.adAccount.id,
        clientId: spec.client.id,
        name: campaignSpec.name,
        objective: campaignSpec.objective,
        status: campaignSpec.status,
      };
      dataset.campaigns.push(campaign);

      for (const adSetSpec of campaignSpec.adSets) {
        const adSet: AdSet = {
          id: adSetSpec.id,
          campaignId: campaign.id,
          name: adSetSpec.name,
          audience: adSetSpec.audience,
          status: adSetSpec.status,
        };
        dataset.adSets.push(adSet);

        for (const adSpec of adSetSpec.ads) {
          const ad: Ad = {
            id: adSpec.id,
            adSetId: adSet.id,
            name: adSpec.name,
            creativeId: adSpec.creativeId,
            status: adSpec.status,
          };
          dataset.ads.push(ad);
          dataset.dailyMetrics.push(
            ...generateAdMetrics(adSpec, options, spec.weeklyConversionPattern),
          );
        }
      }
    }
  }

  dataset.dailyMetrics.sort((a, b) =>
    a.date === b.date ? a.entityId.localeCompare(b.entityId) : a.date.localeCompare(b.date),
  );
  return dataset;
}

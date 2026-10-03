import type { Agency, Dataset, IsoDate } from "@/domain/types";
import { todayInTimezone } from "@/domain/periods";
import { arcCloudSeed } from "./clients/arc-cloud";
import { luxeSkinSeed } from "./clients/luxe-skin";
import { peakFitnessSeed } from "./clients/peak-fitness";
import { buildDataset, SEED_DAYS } from "./generator";
import type { ClientSeedSpec } from "./spec";

export const AGENCY: Agency = { id: "agy_northstar", name: "Northstar Media" };

export const CLIENT_SEEDS: readonly ClientSeedSpec[] = [
  luxeSkinSeed,
  peakFitnessSeed,
  arcCloudSeed,
];

/** The timezone used to decide which calendar day the dataset ends on. */
export const SEED_ANCHOR_TIMEZONE = luxeSkinSeed.client.timezone;

export interface SeedOptions {
  /** Most recent seeded day. Defaults to today in the anchor timezone. */
  anchorDate?: IsoDate;
  days?: number;
}

export function buildSeedDataset(options: SeedOptions = {}): Dataset {
  const anchorDate = options.anchorDate ?? todayInTimezone(SEED_ANCHOR_TIMEZONE);
  return buildDataset(AGENCY, CLIENT_SEEDS, { anchorDate, days: options.days ?? SEED_DAYS });
}

export { SEED_DAYS };

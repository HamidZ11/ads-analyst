import { todayInTimezone } from "@/domain/periods";
import { buildSeedDataset, SEED_ANCHOR_TIMEZONE } from "./seed";
import { InMemoryRepository, type AdAnalystRepository } from "./repository";

let cached: { anchorDate: string; repository: AdAnalystRepository } | null = null;

/**
 * Process-wide repository. The seeded dataset is anchored to today's date in
 * the agency's primary timezone and rebuilt when the calendar day changes, so
 * "last 7 days" always has data.
 */
export function getRepository(): AdAnalystRepository {
  const anchorDate = todayInTimezone(SEED_ANCHOR_TIMEZONE);
  if (!cached || cached.anchorDate !== anchorDate) {
    cached = {
      anchorDate,
      repository: new InMemoryRepository(buildSeedDataset({ anchorDate })),
    };
  }
  return cached.repository;
}

export type { AdAnalystRepository, MetricsQuery, DataCoverage, AdLineage } from "./repository";

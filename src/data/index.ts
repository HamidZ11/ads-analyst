import type { Dataset } from "@/domain/types";
import { todayInTimezone } from "@/domain/periods";
import { buildSeedDataset, SEED_ANCHOR_TIMEZONE } from "./seed";
import { InMemoryRepository, type AdAnalystRepository } from "./repository";

let cached: { anchorDate: string; dataset: Dataset; repository: AdAnalystRepository } | null =
  null;

/**
 * The read-only demo dataset (three seeded clients), anchored to today in the
 * agency's timezone and rebuilt when the day changes. Used only in demo mode
 * and by the design labs; it is never stored and never mixed into a workspace.
 */
export function getDemoRepository(): AdAnalystRepository {
  const anchorDate = todayInTimezone(SEED_ANCHOR_TIMEZONE);
  if (!cached || cached.anchorDate !== anchorDate) {
    const dataset = buildSeedDataset({ anchorDate });
    cached = { anchorDate, dataset, repository: new InMemoryRepository(dataset) };
  }
  return cached.repository;
}

export type { AdAnalystRepository, MetricsQuery, DataCoverage, AdLineage } from "./repository";

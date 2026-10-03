import type { Dataset } from "@/domain/types";
import { todayInTimezone } from "@/domain/periods";
import { composeDataset } from "./compose";
import { buildSeedDataset, SEED_ANCHOR_TIMEZONE } from "./seed";
import { InMemoryRepository, type AdAnalystRepository } from "./repository";
import { EMPTY_STATE, getImportStore, type ImportedState } from "./store";

let seedCache: { anchorDate: string; dataset: Dataset } | null = null;
let cached: { anchorDate: string; revision: string; repository: AdAnalystRepository } | null =
  null;

function readImported(): ImportedState {
  try {
    return getImportStore().read();
  } catch (error) {
    // Never take the product down over unreadable import data; the import
    // service refuses to write until the store can be read again.
    console.error("[ad-analyst] imported data unavailable:", (error as Error).message);
    return EMPTY_STATE;
  }
}

/**
 * Process-wide repository: the seeded demo dataset (anchored to today in the
 * agency's timezone, rebuilt when the day changes) composed with every
 * imported client from the import store (rebuilt when the store changes).
 */
export function getRepository(): AdAnalystRepository {
  const anchorDate = todayInTimezone(SEED_ANCHOR_TIMEZONE);
  const revision = getImportStore().revision();
  if (!cached || cached.anchorDate !== anchorDate || cached.revision !== revision) {
    if (!seedCache || seedCache.anchorDate !== anchorDate)
      seedCache = { anchorDate, dataset: buildSeedDataset({ anchorDate }) };
    cached = {
      anchorDate,
      revision,
      repository: new InMemoryRepository(composeDataset(seedCache.dataset, readImported())),
    };
  }
  return cached.repository;
}

export type { AdAnalystRepository, MetricsQuery, DataCoverage, AdLineage } from "./repository";

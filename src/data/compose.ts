import type { Dataset } from "@/domain/types";
import type { ImportedState } from "./store";

/**
 * One dataset for the repository: the seeded demo clients followed by every
 * imported client. Both kinds share one normalised shape, so every page,
 * Insights and Ask Analyst read them the same way. Imported records are
 * appended, never merged into seeded ones; IDs are namespaced by client.
 */
export function composeDataset(seed: Dataset, imported: ImportedState): Dataset {
  const seededIds = new Set(seed.clients.map((c) => c.id));
  const bundles = imported.clients.filter((b) => !seededIds.has(b.client.id));
  return {
    agency: seed.agency,
    clients: [...seed.clients, ...bundles.map((b) => b.client)],
    adAccounts: [...seed.adAccounts, ...bundles.map((b) => b.adAccount)],
    campaigns: [...seed.campaigns, ...bundles.flatMap((b) => b.campaigns)],
    adSets: [...seed.adSets, ...bundles.flatMap((b) => b.adSets)],
    ads: [...seed.ads, ...bundles.flatMap((b) => b.ads)],
    creatives: [...seed.creatives, ...bundles.flatMap((b) => b.creatives)],
    dailyMetrics: [...seed.dailyMetrics, ...bundles.flatMap((b) => b.dailyMetrics)],
    dataSources: [...(seed.dataSources ?? []), ...bundles.map((b) => b.source)],
  };
}

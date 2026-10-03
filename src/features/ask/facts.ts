import { campaignCreativeFacts } from "@/domain/ask/analytics";
import { scopeKey, type AskData, type AskScope } from "@/domain/ask/model";
import { runInsightEngine } from "@/domain/insights";
import { collectInsightFacts } from "@/features/insights/facts";
import type { Workspace } from "@/features/workspace/server";

export function askScope({ client, periods, comparison }: Workspace): AskScope {
  return {
    key: scopeKey(client.id, periods.current, periods.previous),
    clientId: client.id,
    clientName: client.name,
    currency: client.currency,
    ...periods,
    comparison,
  };
}

export function collectAskData(workspace: Workspace): AskData {
  const { repository, client, periods } = workspace;
  const facts = collectInsightFacts(repository, client, periods);
  const links = repository
    .listAdsForClient(client.id)
    .map((ad) => ({ adId: ad.id, creativeId: ad.creativeId }));
  return {
    scope: askScope(workspace),
    facts,
    findings: runInsightEngine(facts),
    campaignCreatives: Object.fromEntries(
      facts.campaigns.map((campaign) => [
        campaign.entity.id,
        campaignCreativeFacts(
          campaign,
          facts.creatives.map((creative) => creative.entity),
          links,
          periods,
        ),
      ]),
    ),
  };
}

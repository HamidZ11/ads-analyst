import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import { answerQuestion } from "@/domain/ask/answer";
import type { AskAnswer } from "@/domain/ask/model";
import { formatDateRange } from "@/domain/format";
import { conversionVocabulary, tracksRevenue } from "@/domain/labels";
import { comparisonLabel, eachDay, periodPairForPreset } from "@/domain/periods";
import type { Finding } from "@/domain/insights";
import {
  getCampaignRows,
  getClientPeriodSummary,
  type CampaignRow,
  type ClientPeriodSummary,
} from "@/features/analytics/queries";
import { collectAskData } from "@/features/ask/facts";
import { buildInsightsModel, type InsightsModel } from "@/features/insights/insights-model";
import type { Workspace } from "@/features/workspace/server";

/**
 * Every figure on the marketing pages comes from the seeded Luxe Skin Co.
 * account, pinned to 3 October 2026 so the copy and the live product
 * showcases always agree. Nothing here is invented.
 */
export const ANCHOR = "2026-10-03";
export const CPA_QUESTION = "Why did CPA rise this week?";

export interface DailySeries {
  name: string;
  short: string;
  spend: number[];
  conversions: number[];
}

export interface LandingEvidence {
  workspace: Workspace;
  summary: ClientPeriodSummary;
  campaignRows: CampaignRow[];
  insights: InsightsModel;
  deterioration: Finding;
  zeroConversion: Finding;
  answer: AskAnswer;
  /** 60 days, oldest first, one series per campaign. */
  series: DailySeries[];
  days: string[];
  periodLabel: string;
  historyLabel: string;
  currentStartIndex: number;
}

let cached: LandingEvidence | null = null;

export function landingEvidence(): LandingEvidence {
  if (cached) return cached;
  const repository = new InMemoryRepository(buildSeedDataset({ anchorDate: ANCHOR }));
  const client = repository.getClient("cli_luxe");
  if (!client) throw new Error("Seeded Luxe Skin Co. client is missing.");
  const periods = periodPairForPreset("7d", ANCHOR);
  const workspace: Workspace = {
    agency: repository.getAgency(),
    clients: repository.listClients(),
    client,
    adAccount: repository.listAdAccounts(client.id)[0] ?? null,
    coverage: repository.getCoverage(client.id),
    dataSource: repository.getDataSource(client.id),
    mode: "demo",
    user: null,
    workspace: { id: repository.getAgency().id, name: repository.getAgency().name },
    canImport: false,
    preset: "7d",
    periods,
    comparison: comparisonLabel(periods),
    today: ANCHOR,
    repository,
  };

  const insights = buildInsightsModel(workspace);
  const find = (detector: Finding["detector"], entityId: string) => {
    const finding = insights.findings.find(
      (f) => f.detector === detector && f.entity.id === entityId,
    );
    if (!finding) throw new Error(`Seeded finding ${detector}:${entityId} is missing.`);
    return finding;
  };

  const coverage = workspace.coverage;
  if (!coverage) throw new Error("Seeded coverage is missing.");
  const days = eachDay({ start: coverage.firstDate, end: coverage.lastDate });
  const rows = repository.queryMetrics({ clientId: client.id, entityType: "ad" });
  const series = repository.listCampaigns(client.id).map((campaign) => {
    const ads = new Set(
      repository
        .listAdSets(campaign.id)
        .flatMap((set) => repository.listAds(set.id))
        .map((ad) => ad.id),
    );
    const spend = new Map<string, number>();
    const conversions = new Map<string, number>();
    for (const row of rows) {
      if (!ads.has(row.entityId)) continue;
      spend.set(row.date, (spend.get(row.date) ?? 0) + row.spend);
      conversions.set(row.date, (conversions.get(row.date) ?? 0) + row.conversions);
    }
    const parts = campaign.name.split(" | ");
    return {
      name: campaign.name,
      short: parts[parts.length - 1] ?? campaign.name,
      spend: days.map((d) => spend.get(d) ?? 0),
      conversions: days.map((d) => conversions.get(d) ?? 0),
    };
  });

  cached = {
    workspace,
    summary: getClientPeriodSummary(repository, client, periods),
    campaignRows: getCampaignRows(repository, client, periods),
    insights,
    deterioration: find("campaign_deterioration", "cmp_luxe_05"),
    zeroConversion: find("zero_conversion_spend", "cmp_luxe_03"),
    answer: answerQuestion(CPA_QUESTION, collectAskData(workspace)).answer,
    series,
    days,
    periodLabel: formatDateRange(periods.current),
    historyLabel: formatDateRange({ start: coverage.firstDate, end: coverage.lastDate }),
    currentStartIndex: days.indexOf(periods.current.start),
  };
  return cached;
}

export function campaignsTableProps(evidence: LandingEvidence) {
  const { client, comparison } = evidence.workspace;
  return {
    rows: evidence.campaignRows,
    currency: client.currency,
    vocabulary: conversionVocabulary(client.type),
    comparison,
    showRoas: tracksRevenue(client),
    targetCpa: client.targetCpa,
  };
}

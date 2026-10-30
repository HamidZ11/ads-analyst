import {
  CREATIVE_TYPE_LABELS,
  OBJECTIVE_LABELS,
  conversionVocabulary,
  primaryMetricKeys,
  tracksRevenue,
} from "@/domain/labels";
import {
  accountChart,
  countByPriority,
  runInsightEngine,
  type InsightChart,
  type PriorityCounts,
} from "@/domain/insights";
import { formatDate, formatDateRange } from "@/domain/format";
import { METRIC_DEFINITIONS, percentChange } from "@/domain/metrics";
import type { CurrencyCode, DateRange, MetricKey } from "@/domain/types";
import {
  getCampaignRows,
  getClientPeriodSummary,
  getCreativeRows,
  getKpiReadings,
} from "@/features/analytics/queries";
import { collectInsightFacts } from "@/features/insights/facts";
import type { Workspace } from "@/features/workspace/server";
import { toClientFinding, type ClientFinding } from "./client-wording";

/**
 * Everything a client report shows, computed from the same queries and rules
 * as the app's pages (Overview KPIs, the Campaigns rows, the Creatives rows,
 * the insight engine), so a figure in the report is the figure in the app.
 * Only the agency's "What we're doing next" note is stored; it is loaded
 * separately.
 */

export const REPORT_FINDINGS = 6;
export const REPORT_CAMPAIGNS = 5;
export const REPORT_CREATIVES = 5;

export interface ReportMetric {
  key: MetricKey;
  /** In the client's words: "Purchases", "Cost per purchase", "Return on ad spend". */
  label: string;
  current: number | null;
  previous: number | null;
  change: number | null;
  higherIsBetter: boolean | null;
  /** The client's own target for this metric, when one is set. */
  target: number | null;
}

export interface ReportEntityRow {
  id: string;
  name: string;
  /** Campaign objective or creative format. */
  detail: string;
  spend: number;
  spendChange: number | null;
  conversions: number;
  conversionsChange: number | null;
  cpa: number | null;
  /** ROAS when the client tracks revenue, otherwise null. */
  roas: number | null;
}

export interface ClientReportModel {
  /** The agency sending the report: the workspace name, or the demo agency. */
  agencyName: string;
  clientName: string;
  clientId: string;
  currency: CurrencyCode;
  demo: boolean;
  conversionPlural: string;
  costLabel: string;
  showRoas: boolean;
  current: DateRange;
  previous: DateRange;
  currentLabel: string;
  previousLabel: string;
  /** "previous 7 days". */
  comparison: string;
  preparedOn: string;
  metrics: ReportMetric[];
  charts: InsightChart[];
  findings: ClientFinding[];
  findingCounts: PriorityCounts;
  findingTotal: number;
  campaigns: ReportEntityRow[];
  campaignTotal: number;
  creatives: ReportEntityRow[];
  creativeTotal: number;
}

const CLIENT_METRIC_LABELS: Partial<Record<MetricKey, string>> = {
  roas: "Return on ad spend",
  ctr: "Click-through rate",
  cpc: "Cost per click",
  cpm: "Cost per 1,000 impressions",
};

export function reportMetricLabel(
  key: MetricKey,
  workspace: Pick<Workspace, "client">,
): string {
  const vocab = conversionVocabulary(workspace.client.type);
  if (key === "conversions") return vocab.plural;
  if (key === "cpa") return vocab.costLabel;
  return CLIENT_METRIC_LABELS[key] ?? METRIC_DEFINITIONS[key].label;
}

export function buildClientReport(workspace: Workspace): ClientReportModel {
  const { repository, client, periods, comparison } = workspace;
  const vocab = conversionVocabulary(client.type);
  const showRoas = tracksRevenue(client);

  const summary = getClientPeriodSummary(repository, client, periods);
  const metrics = getKpiReadings(summary, primaryMetricKeys(client)).map((reading) => ({
    key: reading.key,
    label: reportMetricLabel(reading.key, workspace),
    current: reading.current,
    previous: reading.previous,
    change: reading.change,
    higherIsBetter: METRIC_DEFINITIONS[reading.key].higherIsBetter,
    target:
      reading.key === "cpa" && client.targetCpa !== null
        ? client.targetCpa
        : reading.key === "roas" && client.targetRoas !== null
          ? client.targetRoas
          : null,
  }));

  const facts = collectInsightFacts(repository, client, periods);
  const findings = runInsightEngine(facts);
  const charts = [accountChart(facts, "conversions"), accountChart(facts, "spend")].filter(
    (chart): chart is InsightChart => chart !== null,
  );

  const campaignRows = getCampaignRows(repository, client, periods)
    .filter((row) => row.current.totals.spend > 0)
    .sort((a, b) => b.current.totals.spend - a.current.totals.spend);
  const creativeRows = getCreativeRows(repository, client, periods)
    .filter((row) => row.current.totals.spend > 0)
    .sort((a, b) => b.current.totals.spend - a.current.totals.spend);

  return {
    agencyName:
      workspace.mode === "supabase" ? workspace.workspace.name : workspace.agency.name,
    clientName: client.name,
    clientId: client.id,
    currency: client.currency,
    demo: workspace.mode === "demo",
    conversionPlural: vocab.plural,
    costLabel: vocab.costLabel,
    showRoas,
    current: periods.current,
    previous: periods.previous,
    currentLabel: formatDateRange(periods.current),
    previousLabel: formatDateRange(periods.previous),
    comparison,
    preparedOn: formatDate(workspace.today, { year: true }),
    metrics,
    charts,
    findings: findings.slice(0, REPORT_FINDINGS).map((f) => toClientFinding(f, vocab)),
    findingCounts: countByPriority(findings),
    findingTotal: findings.length,
    campaigns: campaignRows.slice(0, REPORT_CAMPAIGNS).map((row) => ({
      id: row.campaign.id,
      name: row.campaign.name,
      detail: row.campaign.objective ? OBJECTIVE_LABELS[row.campaign.objective] : "",
      spend: row.current.totals.spend,
      spendChange: row.spendChange,
      conversions: row.current.totals.conversions,
      conversionsChange: row.conversionsChange,
      cpa: row.current.derived.cpa,
      roas: showRoas ? row.current.derived.roas : null,
    })),
    campaignTotal: campaignRows.length,
    creatives: creativeRows.slice(0, REPORT_CREATIVES).map((row) => ({
      id: row.creative.id,
      name: row.creative.name,
      detail: CREATIVE_TYPE_LABELS[row.creative.type],
      spend: row.current.totals.spend,
      spendChange: row.spendChange,
      conversions: row.current.totals.conversions,
      conversionsChange: percentChange(
        row.current.totals.conversions,
        row.previous.totals.conversions,
      ),
      cpa: row.current.derived.cpa,
      roas: showRoas ? row.current.derived.roas : null,
    })),
    creativeTotal: creativeRows.length,
  };
}

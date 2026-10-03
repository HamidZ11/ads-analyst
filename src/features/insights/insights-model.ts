import {
  briefingSentence,
  countByPriority,
  periodPhrase,
  runInsightEngine,
  type Finding,
  type PriorityCounts,
} from "@/domain/insights";
import { formatDateRange } from "@/domain/format";
import { rangeLength } from "@/domain/periods";
import type { CurrencyCode } from "@/domain/types";
import type { Workspace } from "@/features/workspace/server";
import { collectInsightFacts } from "./facts";

/** Everything the Insights page renders; serialisable for the client workspace. */
export interface InsightsModel {
  clientName: string;
  currency: CurrencyCode;
  findings: Finding[];
  counts: PriorityCounts;
  briefing: string;
  /** "in the last 7 days", "today". */
  period: string;
  currentLabel: string;
  previousLabel: string;
  comparison: string;
  campaignCount: number;
  creativeCount: number;
}

export function buildInsightsModel(workspace: Workspace): InsightsModel {
  const { repository, client, periods, comparison } = workspace;
  const facts = collectInsightFacts(repository, client, periods);
  const findings = runInsightEngine(facts);
  const counts = countByPriority(findings);
  const period = periodPhrase(periods.preset, rangeLength(periods.current));
  return {
    clientName: client.name,
    currency: client.currency,
    findings,
    counts,
    briefing: briefingSentence(counts, client.name, period),
    period,
    currentLabel: formatDateRange(periods.current),
    previousLabel: formatDateRange(periods.previous),
    comparison,
    campaignCount: facts.campaigns.length,
    creativeCount: facts.creatives.length,
  };
}

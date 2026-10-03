import type { DatePreset } from "../periods";
import type { Finding, InsightPriority } from "./model";

export type PriorityCounts = Record<InsightPriority, number>;

export function countByPriority(
  findings: readonly Pick<Finding, "priority">[],
): PriorityCounts {
  const counts: PriorityCounts = { high: 0, opportunity: 0, watch: 0 };
  for (const f of findings) counts[f.priority] += 1;
  return counts;
}

/** How the selected period reads inside a sentence: "today", "in the last 7 days". */
export function periodPhrase(preset: DatePreset, days: number): string {
  if (preset === "today") return "today";
  if (preset === "yesterday") return "yesterday";
  return days === 1 ? "on the selected day" : `in the last ${days} days`;
}

/**
 * The one-sentence orientation above the workspace, built from real counts:
 * "3 issues need attention, 3 opportunities and 2 things to watch for
 * Luxe Skin Co. in the last 7 days."
 */
export function briefingSentence(counts: PriorityCounts, clientName: string, period: string) {
  const total = counts.high + counts.opportunity + counts.watch;
  if (total === 0) return `No findings for ${clientName} ${period}.`;
  const high =
    counts.high === 0
      ? "Nothing needs attention"
      : `${counts.high} ${counts.high === 1 ? "issue needs" : "issues need"} attention`;
  const opportunities =
    counts.opportunity === 0
      ? "no opportunities"
      : `${counts.opportunity} ${counts.opportunity === 1 ? "opportunity" : "opportunities"}`;
  const watch =
    counts.watch === 0
      ? "nothing to watch"
      : `${counts.watch} ${counts.watch === 1 ? "thing" : "things"} to watch`;
  return `${high}, ${opportunities} and ${watch} for ${clientName} ${period}.`;
}

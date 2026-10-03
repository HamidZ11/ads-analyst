import { ArrowUpRight } from "lucide-react";
import type { InsightsLab } from "./fixtures";
import { EntityLine, EvidenceMetric, LabHeader, PriorityLabel, PriorityTabs } from "./shared";

/**
 * Concept A — Priority Analysis Feed. One ranked feed of findings, each an
 * open row: priority and detector, factual headline, entity, three or four
 * evidence metrics, the suggested action and a compact "why flagged" line.
 */
export function ConceptA({ lab }: { lab: InsightsLab }) {
  const { fixtures, counts } = lab;
  const ordered = [...fixtures].sort(
    (a, b) =>
      ["high", "opportunity", "watch"].indexOf(a.priority) -
      ["high", "opportunity", "watch"].indexOf(b.priority),
  );
  return (
    <>
      <LabHeader lab={lab} />
      <div className="flex items-end justify-between gap-4 border-b border-border">
        <PriorityTabs counts={counts} />
        <p className="pb-2.5 text-xs text-ink-muted">Ranked by priority</p>
      </div>
      <ol className="divide-y divide-border">
        {ordered.map((f) => (
          <li key={f.id} className="grid grid-cols-[140px_minmax(0,1fr)_120px] gap-x-8 py-5">
            <div>
              <PriorityLabel priority={f.priority} />
              <p className="mt-1 text-xs text-ink-faint">{f.detector}</p>
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink">
                {f.headline}
              </h3>
              <EntityLine entity={f.entity} className="mt-1" />
              <div className="mt-3 grid grid-cols-4 gap-x-6">
                {f.evidence.slice(0, 4).map((e) => (
                  <EvidenceMetric key={e.label} item={e} />
                ))}
              </div>
              <p className="mt-3 text-sm text-ink-secondary">
                <span className="text-ink-muted">Suggested action</span> · {f.action}
              </p>
              <p className="mt-1 text-xs text-ink-faint">
                Flagged because {f.whyFlagged.charAt(0).toLowerCase() + f.whyFlagged.slice(1)}
              </p>
            </div>
            <div className="flex items-start justify-end">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                Inspect <ArrowUpRight aria-hidden size={13} />
              </span>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { InsightFixture, InsightsLab, Priority } from "./fixtures";
import { EntityLine, EvidenceMetric, LabHeader, PriorityDot } from "./shared";

const GROUPS: Array<{ priority: Priority; title: string; empty: string }> = [
  {
    priority: "high",
    title: "Needs attention",
    empty: "No high-impact findings for this period",
  },
  {
    priority: "opportunity",
    title: "Opportunities",
    empty: "No opportunities for this period",
  },
  { priority: "watch", title: "Watch", empty: "Nothing to watch for this period" },
];

function Item({ f, compact = false }: { f: InsightFixture; compact?: boolean }) {
  return (
    <li className={cn("py-4", compact ? "" : "grid grid-cols-[minmax(0,1fr)_360px] gap-x-10")}>
      <div className="min-w-0">
        <h3 className="text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink">
          {f.headline}
        </h3>
        <EntityLine entity={f.entity} className="mt-1" />
        <p className="mt-2 text-sm text-ink-secondary">{f.action}</p>
        <p className="mt-1 text-xs text-ink-faint">
          {f.detector} · {f.whyFlagged}
        </p>
      </div>
      <div className={cn("grid gap-x-5", compact ? "mt-3 grid-cols-3" : "grid-cols-3")}>
        {f.evidence.slice(0, 3).map((e) => (
          <EvidenceMetric key={e.label} item={e} size="sm" />
        ))}
      </div>
    </li>
  );
}

export function BriefingSection({
  group,
  items,
  compact = false,
}: {
  group: (typeof GROUPS)[number];
  items: InsightFixture[];
  compact?: boolean;
}) {
  return (
    <section aria-labelledby={`briefing-${group.priority}`} className="min-w-0">
      <div className="flex items-center justify-between gap-4">
        <h2
          id={`briefing-${group.priority}`}
          className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em] text-ink"
        >
          <PriorityDot priority={group.priority} />
          {group.title}
          <span className="text-sm font-normal text-ink-muted tabular">{items.length}</span>
        </h2>
        {items.length > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
            Review <ArrowUpRight aria-hidden size={13} />
          </span>
        ) : null}
      </div>
      {items.length === 0 ? (
        <div className="mt-3 border-t border-border pt-4">
          <p className="text-sm font-medium text-ink">{group.empty}</p>
          <p className="mt-1 text-xs text-ink-muted">
            Other groups may still hold findings. Findings are recomputed for every period.
          </p>
        </div>
      ) : (
        <ol className="mt-1 divide-y divide-border border-t border-border">
          {items.map((f) => (
            <Item key={f.id} f={f} compact={compact} />
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Concept C — Analytical Briefing. A one-sentence summary, then findings
 * grouped by decision category: Needs attention full width with evidence to
 * the right of each finding; Opportunities and Watch side by side beneath.
 */
export function ConceptC({
  lab,
  emptyDemo = false,
}: {
  lab: InsightsLab;
  emptyDemo?: boolean;
}) {
  const { fixtures, counts, client } = lab;
  const byPriority = (p: Priority) =>
    emptyDemo && p === "high" ? [] : fixtures.filter((f) => f.priority === p);
  const high = byPriority("high");
  const summary = `${high.length === 0 ? "Nothing needs attention" : `${high.length} ${high.length === 1 ? "issue needs" : "issues need"} attention`}, ${counts.opportunity} ${counts.opportunity === 1 ? "opportunity" : "opportunities"} and ${counts.watch} ${counts.watch === 1 ? "thing" : "things"} to watch for ${client.name} this period.`;
  return (
    <>
      <LabHeader
        lab={lab}
        subtitle={`${client.name} · computed from the selected period against the ${lab.comparison}`}
      />
      <p className="max-w-[760px] text-[18px] leading-7 font-medium tracking-[-0.01em] text-ink">
        {summary}
      </p>
      <div className="mt-8">
        <BriefingSection group={GROUPS[0]} items={high} />
      </div>
      <div className="mt-10 grid grid-cols-2 gap-x-12">
        <BriefingSection group={GROUPS[1]} items={byPriority("opportunity")} compact />
        <BriefingSection group={GROUPS[2]} items={byPriority("watch")} compact />
      </div>
      <p className="mt-8 text-xs text-ink-muted">
        Findings are computed from daily metrics for the selected period; suggested actions are
        not applied automatically.
      </p>
    </>
  );
}

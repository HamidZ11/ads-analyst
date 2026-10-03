import { PageHeader } from "@/components/ui/page-header";
import { Delta } from "@/components/ui/delta";
import { formatDateRange } from "@/domain/format";
import { cn } from "@/lib/cn";
import { StaticPresets } from "../campaigns-lab/lab-frame";
import { PRIORITY_LABEL, type Evidence, type InsightsLab, type Priority } from "./fixtures";

export const MATERIALITY = 0.05;

const DOT: Record<Priority, string> = {
  high: "bg-negative",
  opportunity: "bg-accent",
  watch: "border border-ink-faint bg-transparent",
};

const TEXT: Record<Priority, string> = {
  high: "text-ink",
  opportunity: "text-ink",
  watch: "text-ink-muted",
};

/** The 6px priority dot on its own, for group headings. */
export function PriorityDot({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("size-1.5 shrink-0 rounded-full", DOT[priority], className)}
    />
  );
}

/** Priority as a 6px dot and a 12px word; never a coloured box. */
export function PriorityLabel({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        TEXT[priority],
        className,
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[priority])} />
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

/** One evidence metric: label above, value, change or note beneath. */
export function EvidenceMetric({
  item,
  size = "md",
}: {
  item: Evidence;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-ink-muted">{item.label}</p>
      <p
        className={cn(
          "mt-0.5 font-semibold tracking-[-0.01em] text-ink tabular",
          size === "lg" ? "text-xl" : size === "md" ? "text-[15px] leading-5" : "text-sm",
        )}
      >
        {item.value}
      </p>
      {item.change !== undefined || item.note ? (
        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted tabular">
          {item.change !== undefined ? (
            <Delta
              change={item.change}
              higherIsBetter={item.higherIsBetter ?? null}
              neutralBelow={MATERIALITY}
            />
          ) : null}
          {item.note ? <span>{item.note}</span> : null}
        </p>
      ) : null}
    </div>
  );
}

export function LabHeader({ lab, subtitle }: { lab: InsightsLab; subtitle?: string }) {
  const { workspace, client, comparison, fixtures } = lab;
  return (
    <PageHeader
      title="Insights"
      description={
        subtitle ?? `${client.name} · ${fixtures.length} findings from the selected period`
      }
      actions={
        <>
          <span className="text-xs text-ink-muted md:text-right">
            <span className="block font-medium text-ink-secondary">
              {formatDateRange(workspace.periods.current)}
            </span>
            <span className="mt-0.5 block">vs {comparison}</span>
          </span>
          <StaticPresets selected={workspace.preset} />
        </>
      }
    />
  );
}

/** Underline priority tabs with counts (static unless a concept wires them). */
export function PriorityTabs({
  counts,
  selected = "all",
  onSelect,
}: {
  counts: InsightsLab["counts"];
  selected?: "all" | Priority;
  onSelect?: (value: "all" | Priority) => void;
}) {
  const tabs: Array<{ value: "all" | Priority; label: string; count: number }> = [
    { value: "all", label: "All", count: counts.high + counts.opportunity + counts.watch },
    { value: "high", label: "High impact", count: counts.high },
    { value: "opportunity", label: "Opportunities", count: counts.opportunity },
    { value: "watch", label: "Watch", count: counts.watch },
  ];
  return (
    <div role="group" aria-label="Filter by priority" className="flex gap-6">
      {tabs.map((tab) => {
        const pressed = tab.value === selected;
        const cls = cn(
          "-mb-px flex h-9 items-center gap-1.5 border-b-2 text-sm font-medium transition-colors",
          pressed
            ? "border-accent text-ink"
            : "border-transparent text-ink-muted hover:text-ink",
        );
        return onSelect ? (
          <button
            key={tab.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onSelect(tab.value)}
            className={cls}
          >
            {tab.label}
            <span className="text-xs text-ink-faint tabular">{tab.count}</span>
          </button>
        ) : (
          <span key={tab.value} aria-pressed={pressed} className={cls}>
            {tab.label}
            <span className="text-xs text-ink-faint tabular">{tab.count}</span>
          </span>
        );
      })}
    </div>
  );
}

/** "Campaign · Prospecting · Advantage+ Shopping" entity line. */
export function EntityLine({
  entity,
  className,
}: {
  entity: { kind: string; name: string; meta?: string };
  className?: string;
}) {
  return (
    <p className={cn("text-xs text-ink-muted", className)}>
      <span className="text-ink-faint">{entity.kind}</span>
      <span aria-hidden> · </span>
      <span className="font-medium text-ink-secondary">{entity.name}</span>
      {entity.meta ? <span> · {entity.meta}</span> : null}
    </p>
  );
}

import { PRIORITY_LABELS, type InsightPriority } from "@/domain/insights";
import { cn } from "@/lib/cn";

/** Priority is a 6px dot: red for high impact, blue for opportunity, an outline for watch. */
const DOT: Record<InsightPriority, string> = {
  high: "bg-negative",
  opportunity: "bg-accent",
  watch: "border border-ink-faint bg-transparent",
};

export function PriorityDot({
  priority,
  className,
}: {
  priority: InsightPriority;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-1.5 shrink-0 rounded-full", DOT[priority], className)}
    />
  );
}

export function PriorityLabel({
  priority,
  className,
}: {
  priority: InsightPriority;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium",
        priority === "watch" ? "text-ink-secondary" : "text-ink",
        className,
      )}
    >
      <PriorityDot priority={priority} />
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

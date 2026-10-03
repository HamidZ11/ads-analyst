import { ArrowDown, ArrowUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { Delta } from "@/components/ui/delta";
import { STATUS_LABELS } from "@/domain/labels";
import type { EntityStatus } from "@/domain/types";
import { cn } from "@/lib/cn";

/** Change coloured only when material (5%) and directional; spend is never coloured. */
export function Change({
  change,
  higherIsBetter,
  className,
}: {
  change: number | null;
  higherIsBetter: boolean | null;
  className?: string;
}) {
  return (
    <Delta
      change={change}
      higherIsBetter={higherIsBetter}
      neutralBelow={0.05}
      className={className}
    />
  );
}

const DOT: Record<EntityStatus, string> = {
  active: "bg-positive",
  paused: "border border-ink-faint bg-transparent",
  archived: "bg-border-strong",
};

/** Status as a 6px dot: filled green for active, hollow grey for paused. */
export function StatusDot({
  status,
  withLabel = false,
  className,
}: {
  status: EntityStatus;
  withLabel?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", DOT[status])} />
      <span className={withLabel ? "text-xs text-ink-secondary" : "sr-only"}>
        {STATUS_LABELS[status]}
      </span>
    </span>
  );
}

/** Static sortable header: the active column shows its direction in blue; others reveal an arrow on hover. */
export function SortHeader({
  children,
  numeric = false,
  active = false,
  className,
}: {
  children: ReactNode;
  numeric?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? "descending" : "none"}
      className={cn("group h-9 px-3 align-middle font-medium whitespace-nowrap", className)}
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 text-xs transition-colors group-hover:text-ink",
          numeric && "flex-row-reverse",
          active ? "text-ink" : "text-ink-muted",
        )}
      >
        {children}
        {active ? (
          <ArrowDown aria-hidden size={12} className="text-accent" />
        ) : (
          <ArrowUpDown
            aria-hidden
            size={12}
            className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100"
          />
        )}
      </span>
    </th>
  );
}

/** The search control as rendered in production, without a handler (lab only). */
export function SearchField({ className }: { className?: string }) {
  return (
    <label className={cn("relative inline-flex items-center", className)}>
      <span className="sr-only">Search campaigns</span>
      <svg
        aria-hidden
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-2.5 text-ink-faint"
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        placeholder="Search campaigns"
        className="h-8 w-full rounded-md border border-border bg-surface pr-2.5 pl-8 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-border-strong focus-visible:border-accent-border focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
      />
    </label>
  );
}

/** Static replica of the production segmented control. */
export function Segmented({
  options,
  selected,
  className,
}: {
  options: string[];
  selected: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5",
        className,
      )}
    >
      {options.map((option) => (
        <span
          key={option}
          className={cn(
            "flex h-7 items-center rounded-sm px-2.5 text-xs font-medium",
            option === selected ? "bg-accent-soft text-accent-strong" : "text-ink-muted",
          )}
        >
          {option}
        </span>
      ))}
    </div>
  );
}

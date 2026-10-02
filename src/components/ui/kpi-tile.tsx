import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Delta } from "./delta";
import { Sparkline } from "./sparkline";

export interface KpiTileProps {
  label: string;
  value: string;
  change: number | null;
  higherIsBetter: boolean | null;
  /** Baseline the delta is measured against, e.g. "previous 7 days". */
  comparison: string;
  icon?: LucideIcon;
  series?: readonly (number | null)[];
  splitIndex?: number;
  /** Secondary context appended to the comparison line, e.g. "Target £28". */
  hint?: string;
  className?: string;
}

/**
 * Stat tile: label row with a functional icon, a strong numeral that is never
 * clipped, the comparison context beneath it, and the trend + delta pill on
 * the right. Below 640px the sparkline is dropped and the pill moves under the
 * numeral so two tiles fit side by side on a phone.
 */
export function KpiTile({
  label,
  value,
  change,
  higherIsBetter,
  comparison,
  icon: Icon,
  series,
  splitIndex,
  hint,
  className,
}: KpiTileProps) {
  const delta = <Delta change={change} higherIsBetter={higherIsBetter} variant="pill" />;
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface px-4 py-3.5 shadow-xs",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-ink-secondary">{label}</p>
        {Icon ? (
          <Icon aria-hidden size={14} strokeWidth={1.75} className="shrink-0 text-ink-faint" />
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-3xl leading-none font-semibold whitespace-nowrap text-ink">
            {value}
          </p>
          <p className="mt-2 text-2xs leading-4 text-ink-muted">
            vs {comparison}
            {hint ? <span className="text-ink-faint"> · {hint}</span> : null}
          </p>
        </div>
        <div className="hidden shrink-0 flex-col items-end gap-1.5 sm:flex">
          {series ? <Sparkline values={series} splitIndex={splitIndex} /> : null}
          {delta}
        </div>
      </div>
      <div className="sm:hidden">{delta}</div>
    </div>
  );
}

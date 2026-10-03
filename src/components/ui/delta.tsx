import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { formatChange } from "@/domain/format";
import { cn } from "@/lib/cn";

export interface DeltaProps {
  change: number | null;
  /** true: up is good; false: up is bad; null: directional only. */
  higherIsBetter: boolean | null;
  /** `text` for table cells and inline use; `pill` for stat tiles. */
  variant?: "text" | "pill";
  /** Keep small movements legible without giving every row a semantic colour. */
  neutralBelow?: number;
  className?: string;
}

type Sentiment = "good" | "bad" | "neutral";

const TEXT_CLASSES: Record<Sentiment, string> = {
  good: "text-positive",
  bad: "text-negative",
  neutral: "text-ink-secondary",
};

const PILL_CLASSES: Record<Sentiment, string> = {
  good: "bg-positive-soft text-positive",
  bad: "bg-negative-soft text-negative",
  neutral: "bg-surface-active text-ink-secondary",
};

/** Signed relative change coloured by whether the direction is desirable. */
export function Delta({
  change,
  higherIsBetter,
  variant = "text",
  neutralBelow = 0.0005,
  className,
}: DeltaProps) {
  if (change === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center text-xs text-ink-faint tabular",
          variant === "pill" && "h-5 rounded-sm bg-surface-active px-1.5",
          className,
        )}
      >
        —<span className="sr-only">no comparison available</span>
      </span>
    );
  }
  const flat = Math.abs(change) < 0.0005;
  const quiet = Math.abs(change) < neutralBelow;
  const up = change > 0;
  const sentiment: Sentiment =
    flat || quiet || higherIsBetter === null
      ? "neutral"
      : up === higherIsBetter
        ? "good"
        : "bad";
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium tabular",
        variant === "pill"
          ? cn("h-5 rounded-sm px-1.5", PILL_CLASSES[sentiment])
          : TEXT_CLASSES[sentiment],
        className,
      )}
    >
      <Icon aria-hidden size={12} strokeWidth={2.25} />
      {formatChange(change)}
      <span className="sr-only">{flat ? "unchanged" : up ? "increase" : "decrease"}</span>
    </span>
  );
}

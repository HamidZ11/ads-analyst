import type { HTMLAttributes } from "react";
import { STATUS_LABELS } from "@/domain/labels";
import type { EntityStatus } from "@/domain/types";
import { cn } from "@/lib/cn";

export type BadgeTone = "neutral" | "accent" | "positive" | "negative" | "warning" | "outline";

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-surface-active text-ink-secondary",
  accent: "bg-accent-soft text-accent-strong",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  warning: "bg-warning-soft text-warning",
  outline: "bg-surface text-ink-secondary border border-border",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 rounded-sm px-1.5 text-2xs font-medium whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
      {...props}
    />
  );
}

const STATUS_DOT: Record<EntityStatus, string> = {
  active: "bg-positive",
  paused: "bg-ink-faint",
  archived: "bg-border-strong",
};

export function StatusBadge({
  status,
  className,
}: {
  status: EntityStatus;
  className?: string;
}) {
  return (
    <Badge tone="outline" className={className}>
      <span aria-hidden className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

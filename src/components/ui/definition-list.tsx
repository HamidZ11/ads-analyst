import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface DefinitionItem {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}

/** Compact label/value rows for settings and record views. */
export function DefinitionList({
  items,
  className,
}: {
  items: DefinitionItem[];
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-border", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4"
        >
          <dt className="text-xs font-medium text-ink-muted">{item.label}</dt>
          <dd className="min-w-0">
            <div className="text-sm text-ink">{item.value}</div>
            {item.detail ? (
              <div className="mt-0.5 text-xs text-ink-muted">{item.detail}</div>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

import type { LucideIcon } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface", className)} {...props} />
  );
}

export interface CardHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Functional icon shown before the title. */
  icon?: LucideIcon;
  /** Compact controls aligned to the right of the header. */
  actions?: ReactNode;
  /** Heading level for the title; defaults to h2. */
  as?: "h2" | "h3";
  className?: string;
}

export function CardHeader({
  title,
  description,
  icon: Icon,
  actions,
  as: Heading = "h2",
  className,
}: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3 px-4 pt-3.5 pb-3", className)}>
      <div className="min-w-0">
        <Heading className="flex items-center gap-2 text-sm font-semibold text-ink">
          {Icon ? (
            <Icon
              aria-hidden
              size={14}
              strokeWidth={1.75}
              className="shrink-0 text-ink-muted"
            />
          ) : null}
          <span className="truncate">{title}</span>
        </Heading>
        {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-4 pb-4", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-b-lg border-t border-border bg-surface-subtle px-4 py-2.5",
        className,
      )}
      {...props}
    />
  );
}

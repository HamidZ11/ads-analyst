import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-[-0.035em] text-ink sm:text-3xl">
          {title}
        </h1>
        {description ? <p className="mt-1 text-[13px] text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

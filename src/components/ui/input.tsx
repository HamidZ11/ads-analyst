import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leading?: ReactNode;
}

export function Input({ leading, className, ...props }: InputProps) {
  return (
    <span className={cn("relative inline-flex w-full items-center", className)}>
      {leading ? (
        <span aria-hidden className="pointer-events-none absolute left-2.5 text-ink-faint">
          {leading}
        </span>
      ) : null}
      <input
        className={cn(
          "h-8 w-full rounded-md border border-border bg-surface text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-border-strong focus-visible:border-accent-border focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent",
          leading ? "pr-2.5 pl-8" : "px-2.5",
        )}
        {...props}
      />
    </span>
  );
}

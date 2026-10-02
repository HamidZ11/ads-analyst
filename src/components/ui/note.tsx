import { Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** A quiet, honest hint about scope: what this surface does not do yet. */
export function Note({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("flex items-start gap-1.5 text-xs text-ink-muted", className)}>
      <Info aria-hidden size={13} className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

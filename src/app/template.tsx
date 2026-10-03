import type { ReactNode } from "react";

/**
 * Remounts on every route change so page content enters with a short
 * fade-and-rise. Server-action re-renders (client or period switches) keep the
 * same instance, so data updates do not re-trigger it.
 */
export default function Template({ children }: { children: ReactNode }) {
  return <div className="motion-safe:animate-page-in">{children}</div>;
}

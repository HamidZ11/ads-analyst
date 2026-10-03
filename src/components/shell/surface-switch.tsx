"use client";

import { useSelectedLayoutSegment } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell, type AppShellProps } from "./app-shell";

/** The `(marketing)` route group renders the public site without the app shell. */
const MARKETING_SEGMENT = "(marketing)";

/**
 * Chooses the frame for the active top-level route: the app shell for app
 * routes in an app session, nothing around the marketing pages, sign-in or the
 * labs. It lives in the root layout so the shell persists across app
 * navigation and the choice follows client-side route changes.
 */
export function SurfaceSwitch({
  shell,
  children,
}: {
  shell: Omit<AppShellProps, "children"> | null;
  children: ReactNode;
}) {
  const segment = useSelectedLayoutSegment();
  if (!shell || segment === MARKETING_SEGMENT) return children;
  return <AppShell {...shell}>{children}</AppShell>;
}

"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";

const subscribe = () => () => {};

/**
 * Mounts the lab overlay on <body>. The production root template animates
 * `transform` with a filled animation, which leaves the wrapper as the
 * containing block for any `position: fixed` descendant; an overlay rendered
 * inside <main> collapses to the wrapper's zero height and sits beneath the
 * fixed sidebar. Portalling to <body> escapes both.
 */
export function LabPortal({ children }: { children: ReactNode }) {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(children, document.body);
}

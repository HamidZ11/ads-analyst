"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";

/**
 * Arms `[data-reveal="scroll"]` elements so they unveil as they enter the
 * viewport. Anything already on screen when the page hydrates is marked shown
 * without arming, so server-rendered content never disappears and reappears.
 * Does nothing under reduced motion. Re-runs on each marketing route.
 */
export function RevealOnScroll() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal="scroll"]'));
    const fold = window.innerHeight * 0.88;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.shown = "";
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -12% 0px" },
    );
    for (const node of nodes) {
      if (node.dataset.shown !== undefined) continue;
      const rect = node.getBoundingClientRect();
      if (rect.top < fold && rect.bottom > 0) {
        node.dataset.shown = "";
      } else {
        node.dataset.armed = "";
        observer.observe(node);
      }
    }
    return () => observer.disconnect();
  }, [pathname]);
  return null;
}

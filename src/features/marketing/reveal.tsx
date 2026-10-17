"use client";

import { usePathname } from "next/navigation";
import { useLayoutEffect } from "react";
import { SECTION_EVENT } from "./section-nav";

/**
 * Arms `[data-reveal="scroll"]` elements so they unveil as they enter the
 * viewport. Anything already on screen when the page hydrates is marked shown
 * without arming, so server-rendered content never disappears and reappears.
 * Does nothing under reduced motion. Re-runs on each marketing route.
 *
 * A jump to a section (a section link, a deep link such as /#how-it-works, or
 * a hash change) settles every panel from the top of the page to the end of
 * that section first: shown at once, with no clip transition, so nothing
 * unveils mid-scroll or arrives still clipped, and the panels skipped over
 * are not left hidden above (D-082).
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
    const settleThrough = (id: string) => {
      const target = id ? document.getElementById(id) : null;
      if (!target) return;
      const end = target.getBoundingClientRect().bottom + window.scrollY;
      for (const node of nodes) {
        if (node.getBoundingClientRect().top + window.scrollY >= end) continue;
        observer.unobserve(node);
        delete node.dataset.armed;
        node.dataset.shown = "";
      }
    };
    settleThrough(decodeURIComponent(window.location.hash.slice(1)));
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
    const onSection = (event: Event) =>
      settleThrough((event as CustomEvent<{ id: string }>).detail.id);
    const onHash = () => settleThrough(decodeURIComponent(window.location.hash.slice(1)));
    window.addEventListener(SECTION_EVENT, onSection);
    window.addEventListener("hashchange", onHash);
    return () => {
      observer.disconnect();
      window.removeEventListener(SECTION_EVENT, onSection);
      window.removeEventListener("hashchange", onHash);
    };
  }, [pathname]);
  return null;
}

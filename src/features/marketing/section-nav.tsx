"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";

/* In-page navigation on the landing page (D-082). Section links scroll
   smoothly (instantly under reduced motion) to a target whose scroll-margin
   clears the sticky bar, replace the URL hash instead of adding history,
   and move focus to the section. Other pages link to "/#id" normally. */

/** Landing sections the nav and footer link to, in document order. */
export const LANDING_SECTIONS = ["product", "agencies", "how-it-works"] as const;
export type LandingSection = (typeof LANDING_SECTIONS)[number];

/** Fired before an in-page scroll so reveals can settle and the nav can lock its state. */
export const SECTION_EVENT = "marketing:section";

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Scroll to a landing section; false when it is not on this page. */
export function goToSection(id: string): boolean {
  const target = document.getElementById(id);
  if (!target) return false;
  window.dispatchEvent(new CustomEvent(SECTION_EVENT, { detail: { id } }));
  target.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
  // Keep the router's state; only the hash changes, and no entry is added.
  window.history.replaceState(window.history.state, "", `#${id}`);
  target.focus({ preventScroll: true });
  return true;
}

/**
 * A link to a landing section. On the landing page a plain left click is
 * handled here (after `onNavigate`, e.g. closing the menu); anywhere else, or
 * with a modifier key, it is an ordinary link to "/#id".
 */
export function SectionLink({
  section,
  onNavigate,
  className,
  current,
  children,
}: {
  section: LandingSection;
  onNavigate?: () => void;
  className?: string;
  current?: boolean;
  children: ReactNode;
}) {
  const onClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    if (window.location.pathname !== "/" || !document.getElementById(section)) {
      onNavigate?.();
      return;
    }
    event.preventDefault();
    onNavigate?.();
    goToSection(section);
  };
  return (
    <Link
      href={`/#${section}`}
      className={className}
      aria-current={current ? "location" : undefined}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}

/**
 * The section being read: a section is active from the moment its top passes
 * a line 32px under the sticky bar until the next section's top does, and
 * "how-it-works" (inside "agencies") runs to the end of "agencies". Above the
 * first section and below the last, nothing is active. Read from element
 * positions on a frame-throttled scroll listener: a one-pixel
 * IntersectionObserver band missed the short how-it-works list and could not
 * say "until the next section". While a section link's scroll is in flight the
 * destination is held, so the nav does not flicker through the sections it
 * passes.
 */
export function useActiveSection(enabled: boolean): LandingSection | null {
  const [active, setActive] = useState<LandingSection | null>(null);
  const held = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const get = (id: LandingSection) => document.getElementById(id);
    if (!LANDING_SECTIONS.every((id) => get(id))) return;

    const compute = (): LandingSection | null => {
      const line = (document.querySelector("header")?.getBoundingClientRect().bottom ?? 0) + 32;
      const top = (id: LandingSection) => get(id)!.getBoundingClientRect().top;
      const regions: [LandingSection, number, number][] = [
        ["product", top("product"), top("agencies")],
        ["agencies", top("agencies"), top("how-it-works")],
        ["how-it-works", top("how-it-works"), get("agencies")!.getBoundingClientRect().bottom],
      ];
      return regions.find(([, start, end]) => start <= line && line < end)?.[0] ?? null;
    };

    let frame = 0;
    const update = () => {
      frame = 0;
      if (!held.current) setActive(compute());
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();

    let watch = 0;
    const onSection = (event: Event) => {
      held.current = true;
      setActive((event as CustomEvent<{ id: LandingSection }>).detail.id);
      // Release once the scroll has been still for a few frames (Safari has no scrollend).
      cancelAnimationFrame(watch);
      let last = -1;
      let still = 0;
      const started = performance.now();
      const step = () => {
        still = window.scrollY === last ? still + 1 : 0;
        last = window.scrollY;
        if (still >= 6 || performance.now() - started > 1500) {
          held.current = false;
          update();
          return;
        }
        watch = requestAnimationFrame(step);
      };
      watch = requestAnimationFrame(step);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener(SECTION_EVENT, onSection);
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(watch);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.removeEventListener(SECTION_EVENT, onSection);
    };
  }, [enabled]);

  return enabled ? active : null;
}

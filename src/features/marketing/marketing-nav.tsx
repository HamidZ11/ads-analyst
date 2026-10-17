"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { APP_HOME } from "@/lib/routes";
import { Mark } from "./mark";
import s from "./marketing.module.css";
import { SectionLink, useActiveSection, type LandingSection } from "./section-nav";

const SECTION_LINKS: { section: LandingSection; label: string }[] = [
  { section: "product", label: "Product" },
  { section: "how-it-works", label: "How it works" },
  { section: "agencies", label: "For agencies" },
];

/**
 * The marketing navigation, sticky at the top of every marketing page, with a
 * hairline once the page has scrolled (D-082). Inline links from 1024px;
 * below that a disclosure menu that closes on navigation and on Escape. The
 * current page is marked `aria-current="page"`; on the landing page the
 * section being read is marked `aria-current="location"`.
 */
export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const active = useActiveSection(pathname === "/");

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > 4);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);
  // The menu must be gone from the layout before a section scroll is measured.
  const closeNow = () => flushSync(() => setOpen(false));
  const pricing = pathname === "/pricing" ? "page" : undefined;

  return (
    <header className={s.navBar} data-scrolled={scrolled && !open ? "" : undefined}>
      <div className={s.nav}>
        <Link href="/" className={s.wordmark} onClick={close}>
          <Mark className={s.mark} />
          Ad Analyst
        </Link>
        <nav aria-label="Main" className={s.links}>
          {SECTION_LINKS.map((link) => (
            <SectionLink
              key={link.section}
              section={link.section}
              current={active === link.section}
            >
              {link.label}
            </SectionLink>
          ))}
          <Link href="/pricing" aria-current={pricing}>
            Pricing
          </Link>
        </nav>
        <div className={s.navActions}>
          <Link href="/sign-in" className={s.quiet}>
            Sign in
          </Link>
          <Link href={APP_HOME} className={s.navCta}>
            Try the demo
          </Link>
        </div>
        <button
          ref={button}
          type="button"
          className={s.menuButton}
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X aria-hidden size={20} /> : <Menu aria-hidden size={20} />}
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>
      <div id={panelId} className={s.menuPanel} hidden={!open}>
        <nav aria-label="Main">
          <ul>
            {SECTION_LINKS.map((link) => (
              <li key={link.section}>
                <SectionLink
                  section={link.section}
                  current={active === link.section}
                  onNavigate={closeNow}
                >
                  {link.label}
                </SectionLink>
              </li>
            ))}
            <li>
              <Link href="/pricing" aria-current={pricing} onClick={close}>
                Pricing
              </Link>
            </li>
            <li>
              <Link href="/sign-in" onClick={close}>
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
        <Link href={APP_HOME} className={s.button} onClick={close}>
          Try the demo
        </Link>
      </div>
    </header>
  );
}

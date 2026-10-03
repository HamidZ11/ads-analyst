"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { APP_HOME } from "@/lib/routes";
import { Mark } from "./mark";
import s from "./marketing.module.css";

const LINKS = [
  { href: "/#product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#agencies", label: "For agencies" },
  { href: "/pricing", label: "Pricing" },
];

/**
 * The marketing navigation. Inline links from 1024px; below that a disclosure
 * menu that closes on navigation and on Escape. The current page is marked
 * with `aria-current`.
 */
export function MarketingNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const button = useRef<HTMLButtonElement>(null);

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
  const current = (href: string) => (href === pathname ? "page" : undefined);

  return (
    <header className={s.navBar}>
      <div className={s.nav}>
        <Link href="/" className={s.wordmark} onClick={close}>
          <Mark className={s.mark} />
          Ad Analyst
        </Link>
        <nav aria-label="Main" className={s.links}>
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} aria-current={current(link.href)}>
              {link.label}
            </Link>
          ))}
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
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} aria-current={current(link.href)} onClick={close}>
                  {link.label}
                </Link>
              </li>
            ))}
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

import Link from "next/link";
import { CONTACT_EMAIL } from "@/lib/site";
import s from "./marketing.module.css";
import { SectionLink } from "./section-nav";

export const LINKEDIN_URL = "https://www.linkedin.com/in/hamid-aziz-05858a33b/";

const FOOTER_LINKS = [
  { href: "/audit", label: "Free audit" },
  { href: "/pricing", label: "Pricing" },
  { href: "/tools", label: "Free tools" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/sign-in", label: "Sign in" },
] as const;

/**
 * The site's end-cap (D-077): the footer nav and who built it on one row,
 * then the wordmark set across the full width with its bottom cropped by the
 * page edge. The wordmark is decorative; the nav carries the links.
 */
export function MarketingFooter({ email = CONTACT_EMAIL }: { email?: string | null }) {
  return (
    <footer className={s.footer}>
      <div className={s.footerInner}>
        <nav aria-label="Footer" className={s.footerLinks}>
          <SectionLink section="product">Product</SectionLink>
          <SectionLink section="how-it-works">How it works</SectionLink>
          {FOOTER_LINKS.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>
        <div className={s.footerMeta}>
          <p>Built by Hamid Aziz in Manchester</p>
          {email ? <a href={`mailto:${email}`}>{email}</a> : null}
          <a href={LINKEDIN_URL} rel="me">
            LinkedIn
          </a>
        </div>
      </div>
      <div aria-hidden className={s.footerWordmark}>
        <span>Ad Analyst</span>
      </div>
    </footer>
  );
}

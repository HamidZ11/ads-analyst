import Link from "next/link";
import { Mark } from "./mark";
import s from "./marketing.module.css";

export function MarketingFooter() {
  return (
    <footer className={s.footer}>
      <div className={s.footerInner}>
        <Link href="/" className={s.wordmark}>
          <Mark className={s.mark} />
          Ad Analyst
        </Link>
        <p>Meta Ads analysis for agencies.</p>
        <nav aria-label="Footer" className={s.footerLinks}>
          <Link href="/pricing">Pricing</Link>
          <Link href="/sign-in">Sign in</Link>
        </nav>
      </div>
    </footer>
  );
}

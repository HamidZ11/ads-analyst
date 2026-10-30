import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { APP_HOME, AUDIT_PATH } from "@/lib/routes";
import s from "./marketing.module.css";

/**
 * The closing call to action on the landing and pricing pages (not the legal
 * pages): the self-serve audit as the filled primary with the demo as a text
 * link, the same actions as the hero (D-076, D-083).
 */
export function CtaBand() {
  return (
    <section className={cn(s.container, s.cta)} aria-labelledby="cta-title">
      <h2 id="cta-title" className={s.ctaTitle}>
        See what your client accounts are wasting.
      </h2>
      <p className={s.ctaLine}>
        Drop in a Meta Ads Manager export and see what Ad Analyst flags. Free, with no sign-up,
        and the file never leaves your browser.
      </p>
      <div className={cn(s.actions, s.ctaActions)}>
        <Link href={AUDIT_PATH} className={s.button}>
          Get a free wasted-spend audit
        </Link>
        <Link href={APP_HOME} className={s.textLink}>
          Try the demo
          <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
        </Link>
      </div>
    </section>
  );
}

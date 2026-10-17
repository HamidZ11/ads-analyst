import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { APP_HOME } from "@/lib/routes";
import { CONTACT_EMAIL } from "@/lib/site";
import { auditMailto } from "./hero";
import s from "./marketing.module.css";

/**
 * The closing call to action on the landing and pricing pages (not the legal
 * pages): the audit as the filled primary with the demo as a text link, or,
 * without a contact address, the demo alone as the primary (D-074).
 */
export function CtaBand({ email = CONTACT_EMAIL }: { email?: string | null }) {
  const audit = auditMailto(email);
  return (
    <section className={cn(s.container, s.cta)} aria-labelledby="cta-title">
      <h2 id="cta-title" className={s.ctaTitle}>
        See what your client accounts are wasting.
      </h2>
      <p className={s.ctaLine}>
        {audit
          ? "Tell us about your agency and we’ll audit your clients’ Meta Ads spend for free."
          : "Open the demo on a sample agency. No sign-up needed."}
      </p>
      <div className={cn(s.actions, s.ctaActions)}>
        {audit ? (
          <>
            <a href={audit} className={s.button}>
              Get a free wasted-spend audit
            </a>
            <Link href={APP_HOME} className={s.textLink}>
              Try the demo
              <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
            </Link>
          </>
        ) : (
          <Link href={APP_HOME} className={s.button}>
            Try the demo
          </Link>
        )}
      </div>
    </section>
  );
}

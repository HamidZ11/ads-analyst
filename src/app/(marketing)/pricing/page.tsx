import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { landingEvidence } from "@/features/marketing/evidence";
import m from "@/features/marketing/marketing.module.css";
import { marketingMetadata } from "@/features/marketing/seo";
import { SpendField } from "@/features/marketing/spend-field";
import { cn } from "@/lib/cn";
import { APP_HOME } from "@/lib/routes";
import s from "./pricing.module.css";

export const metadata: Metadata = marketingMetadata("/pricing");

/* Two buying paths on one stage: Agency (self-serve, £29) and Enterprise
   (more than 10 client accounts, custom pricing). They differ in capacity, not
   features, so the product list is shared beneath both. Billing is not built:
   nothing here starts a subscription. */

const SHARED = [
  "Meta Ads CSV imports",
  "Overview dashboard",
  "Campaign performance analysis",
  "Creative performance analysis",
  "Deterministic Insights",
  "Ask Analyst",
  "Previous-period comparisons",
  "Client-specific CPA and ROAS targets",
];

const FAQ = [
  {
    q: "Can I try Ad Analyst before paying?",
    a: "Yes. The demo opens the whole product on a seeded sample agency, with no sign-up or payment details.",
  },
  {
    q: "How many client accounts can I manage?",
    a: "Up to 10 on the Agency plan, each with its own currency, timezone, conversion and targets.",
  },
  {
    q: "What if I manage more than 10 clients?",
    a: "Enterprise is for agencies with more than 10 client accounts, with custom pricing. It's the same product; a separate feature tier is not required.",
  },
  {
    q: "Does Ad Analyst connect directly to Meta Ads?",
    a: "Not yet. You import the ad-level daily CSV export from Meta Ads Manager; a direct connection comes later.",
  },
  {
    q: "Do I need to enter data by hand?",
    a: "No. Import the CSV and Ad Analyst maps the columns and checks the file, asking only what it can’t work out, such as which column counts as a conversion.",
  },
  {
    q: "Can Ad Analyst change budgets automatically?",
    a: "No. It shows what changed and where to look. Decisions and changes in Meta Ads stay with you.",
  },
];

export default function PricingPage() {
  const { series } = landingEvidence();
  return (
    <>
      <section className={cn(m.container, s.hero)} aria-labelledby="pricing-title">
        <h1 id="pricing-title" className={s.h1}>
          <span>Simple pricing.</span>{" "}
          <span className={s.h1Quiet}>Built for agencies doing the work.</span>
        </h1>
        <p className={s.lead}>Everything in Ad Analyst, for up to 10 client accounts.</p>
      </section>

      <section className={cn(m.container, s.planSection)} aria-label="Plans">
        <div className={s.field}>
          <div className={s.fieldTexture}>
            <SpendField series={series} blurred />
          </div>
          <div className={s.plans}>
            <article className={s.panel} aria-labelledby="plan-agency">
              <h2 id="plan-agency" className={s.planName}>
                Agency
              </h2>
              <p className={s.planFor}>
                For small agencies managing several client ad accounts.
              </p>
              <p className={s.price}>
                <span className={s.priceClip}>
                  <span className={s.priceValue}>
                    <span className={s.currency}>£</span>29
                  </span>
                </span>
                <span className={s.per}>/ month</span>
              </p>
              <p className={s.annual}>£290/year · 2 months free</p>
              <p className={s.capacity}>
                <Check aria-hidden size={16} strokeWidth={1.75} />
                Up to 10 client accounts
              </p>
              <div className={s.planActions}>
                <Link href={APP_HOME} className={m.button}>
                  Try the demo
                </Link>
                <Link href="/sign-in" className={m.textLink}>
                  Sign in
                  <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
                </Link>
              </div>
              <p className={s.planNote}>
                The demo runs on a seeded sample agency. Trying it doesn’t start a subscription.
                Prices in GBP.
              </p>
            </article>

            <article className={s.panel} aria-labelledby="plan-enterprise">
              <h2 id="plan-enterprise" className={s.planName}>
                Enterprise
              </h2>
              <p className={s.planFor}>For agencies managing more than 10 client accounts.</p>
              <p className={s.price}>
                <span className={s.priceClip}>
                  <span className={cn(s.priceValue, s.priceWord)}>Custom</span>
                </span>
                <span className={s.per}>pricing</span>
              </p>
              <p className={s.annual}>The same product, with room for every client.</p>
              <p className={s.capacity}>
                <Check aria-hidden size={16} strokeWidth={1.75} />
                More than 10 client accounts
              </p>
              {/* No contact address exists yet, so this stays honest plain text:
                  no link, no button, nothing that pretends to send an email. */}
              <div className={s.planActions}>
                <p className={s.contact}>Email us for pricing</p>
              </div>
              <p className={s.planNote}>
                Quoted for the number of client accounts you manage. Prices in GBP.
              </p>
            </article>

            <div className={s.shared}>
              <h2 id="plan-shared" className={s.listTitle}>
                Included in both plans
              </h2>
              <ul aria-labelledby="plan-shared">
                {SHARED.map((item) => (
                  <li key={item}>
                    <Check aria-hidden size={16} strokeWidth={1.75} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className={cn(m.container, s.included)} aria-labelledby="included-title">
        <h2 id="included-title" className={s.h2}>
          No feature gates.
        </h2>
        <p className={s.body}>
          Agencies shouldn’t have to choose between basic and advanced analysis. One plan
          includes the whole product: Overview, Campaigns, Creatives, Insights and Ask Analyst,
          for every client in the workspace.
        </p>
      </section>

      <section className={cn(m.container, s.faq)} aria-labelledby="faq-title">
        <h2 id="faq-title" className={s.h2}>
          Questions
        </h2>
        <dl className={s.faqList}>
          {FAQ.map(({ q, a }) => (
            <div key={q}>
              <dt>{q}</dt>
              <dd>{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={cn(m.container, s.close)} aria-labelledby="pricing-close-title">
        <h2 id="pricing-close-title" className={s.closeTitle}>
          Know what changed before your next client call.
        </h2>
        <div className={cn(m.actions, s.closeActions)}>
          <Link href={APP_HOME} className={m.button}>
            Try the demo
          </Link>
          <Link href="/sign-in" className={m.textLink}>
            Sign in
            <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
          </Link>
        </div>
      </section>
    </>
  );
}

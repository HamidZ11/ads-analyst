import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { CPA_QUESTION, landingEvidence } from "@/features/marketing/evidence";
import { CtaBand } from "@/features/marketing/cta-band";
import {
  AnswerExhibit,
  FindingExhibit,
  InsightsWeekExhibit,
} from "@/features/marketing/exhibits";
import m from "@/features/marketing/marketing.module.css";
import { auditMailto, HERO_HEADLINE, HERO_LEAD } from "@/features/marketing/hero";
import {
  CampaignsPageCanvas,
  CreativesCanvas,
  OverviewCanvas,
} from "@/features/marketing/product-canvases";
import { ProductCrop, type Crop } from "@/features/marketing/product-crop";
import cropStyles from "@/features/marketing/product-crop.module.css";
import { homeStructuredData, jsonLd, marketingMetadata } from "@/features/marketing/seo";
import { SpendField } from "@/features/marketing/spend-field";
import {
  countsPhrase,
  ENTITY_TYPE_LABELS,
  formatInsightValue,
  PRIORITY_LABELS,
} from "@/domain/insights";
import { cn } from "@/lib/cn";
import { APP_HOME } from "@/lib/routes";
import { CONTACT_EMAIL } from "@/lib/site";
import s from "./landing.module.css";

export const metadata: Metadata = marketingMetadata("/");

/* Product showcases are the shipped components with seeded data, cropped in
   their own unscaled coordinates. Wide crops render the desktop layout (from
   1024px); compact crops render the real phone layout at 375px. */

const HERO: Crop = { x: 0, y: 0, width: 1136, height: 880 };
const HERO_COMPACT: Crop = { x: 14, y: 16, width: 350, height: 640 };
/** Campaigns: the summary strip, then the ledger without its tabs, search and group row. */
const CAMPAIGN_SUMMARY: Crop = { x: 16, y: 14, width: 1104, height: 84 };
const CAMPAIGN_LEDGER: Crop = { x: 16, y: 204, width: 1104, height: 292 };
const CAMPAIGN_SUMMARY_COMPACT: Crop = { x: 18, y: 12, width: 339, height: 166 };
const ASK: Crop = { x: 0, y: 8, width: 720, height: 568 };
const ASK_COMPACT: Crop = { x: 18, y: 12, width: 339, height: 428 };
/** Creatives: the format split and the two creatives leading by spend, without the tab row. */
const CREATIVES: Crop = { x: 16, y: 72, width: 1104, height: 486 };
const CREATIVES_COMPACT: Crop = { x: 18, y: 136, width: 339, height: 520 };

function Wide({ children }: { children: ReactNode }) {
  return <div className={s.onlyWide}>{children}</div>;
}

function Compact({ children }: { children: ReactNode }) {
  return <div className={s.onlyCompact}>{children}</div>;
}

function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn(s.panel, className)} data-reveal="scroll">
      {children}
    </div>
  );
}

export default function LandingPage() {
  const evidence = landingEvidence();
  const { workspace, insights, zeroConversion, weekRows, answer, series } = evidence;
  const finding = {
    currency: workspace.client.currency,
    currentLabel: insights.currentLabel,
    previousLabel: insights.previousLabel,
  };
  const audit = auditMailto(CONTACT_EMAIL);
  const overviewLabel =
    "Ad Analyst Overview for Luxe Skin Co.: return on ad spend 2.71x against a 3.50x target, spend £7,420, revenue £20.1k, 276 purchases at £26.88 each, with a daily chart against the previous seven days.";
  const heroFindingLabel = `Ad Analyst Insights, ${zeroConversion.entity.name}: ${zeroConversion.headline} ${zeroConversion.evidence
    .map(
      (item) =>
        `${item.label} ${formatInsightValue(item.value, item.format, workspace.client.currency)}`,
    )
    .join(", ")}. Suggested action: ${zeroConversion.action}`;
  const weekTitle = `This week for ${workspace.client.name}`;
  const weekSummary = `${countsPhrase(insights.counts)}.`;
  const weekLabel = `Ad Analyst Insights. ${weekTitle}: ${weekSummary} ${weekRows
    .map(
      (row) =>
        `${PRIORITY_LABELS[row.priority]}, ${ENTITY_TYPE_LABELS[row.entity.type]} ${row.entity.name}: ${row.headline}`,
    )
    .join(" ")}`;
  const summaryLabel =
    "Ad Analyst Campaigns for Luxe Skin Co.: spend £7,420, 276 purchases, 2 of 8 delivering campaigns over the £28 target, largest movement Autumn Reset Sale with cost per purchase up 132.5%.";
  const askLabel = `Ad Analyst Ask Analyst. Question: ${CPA_QUESTION} Answer: ${answer.title} ${answer.summary}`;
  const creativesLabel =
    "Ad Analyst Creatives for Luxe Skin Co.: video takes 49% of spend at 2.08x return on ad spend; image 26% at 3.35x; carousel 26% at 3.26x. Leading by spend: Autumn Reset – 25% Off – Video 15s, £981, 8 purchases, £122.60 each.";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(homeStructuredData()) }}
      />
      <section className={cn(m.container, s.hero)} aria-labelledby="landing-title">
        <h1 id="landing-title" className={s.h1}>
          <span className={s.line}>{HERO_HEADLINE.first}</span>{" "}
          <span className={s.line}>
            {HERO_HEADLINE.second} <span className={s.break}>{HERO_HEADLINE.secondRest}</span>
          </span>
        </h1>
        <div className={s.heroCopy}>
          <p className={s.lead}>{HERO_LEAD}</p>
          {/* The audit is the primary action only when there is an address to
              send it to; otherwise the demo takes the filled button. */}
          <div className={cn(m.actions, s.heroActions)}>
            {audit ? (
              <>
                <a href={audit} className={m.button}>
                  Get a free wasted-spend audit
                </a>
                <Link href={APP_HOME} className={m.textLink}>
                  Try the demo
                  <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
                </Link>
              </>
            ) : (
              <Link href={APP_HOME} className={m.button}>
                Try the demo
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* The Overview is the field's background and the zero-conversion
          finding floats in front of its lower right (below it on phones). The
          crops scale in CSS and the card renders at its own width, so the
          server render is final and visible without JavaScript (D-073). */}
      <section className={cn(m.container, s.showcase)} aria-label="Ad Analyst Overview">
        <div className={s.field}>
          <div className={s.fieldTexture}>
            <SpendField series={series} blurred />
          </div>
          <div className={s.canvas}>
            <Wide>
              <ProductCrop
                source={1136}
                crop={HERO}
                maxScale={1}

                label={overviewLabel}
              >
                <OverviewCanvas evidence={evidence} />
              </ProductCrop>
            </Wide>
            <Compact>
              <ProductCrop
                source={375}
                crop={HERO_COMPACT}
                maxScale={1.15}
                surfaceClassName={cropStyles.fitControls}

                label={overviewLabel}
              >
                <OverviewCanvas evidence={evidence} />
              </ProductCrop>
            </Compact>
          </div>
          <div className={s.float} role="img" aria-label={heroFindingLabel}>
            <div inert aria-hidden className={s.floatSurface}>
              <FindingExhibit finding={zeroConversion} compact {...finding} />
            </div>
          </div>
        </div>
        <p className={s.demoNote}>
          Shown with Luxe Skin Co., Ad Analyst’s seeded demo account.
        </p>
      </section>

      <section id="product" className={cn(m.container, s.split)} aria-labelledby="week-title">
        <div className={s.copy}>
          <h2 id="week-title" className={s.h2}>
            Cut the waste. Scale what works.
          </h2>
          <p className={s.body}>
            Insights ranks every finding for the client: what needs attention, where more budget
            would go further, and what to watch, each with the figure behind it.
          </p>
        </div>
        <Panel className={s.splitPanel}>
          {/* The real Insights counts and list rows, rendered at their own
              size and inert: an excerpt, not a crop (D-079). */}
          <div role="img" aria-label={weekLabel}>
            <div inert aria-hidden className={cn("font-sans text-ink", s.weekSurface)}>
              <InsightsWeekExhibit
                title={weekTitle}
                summary={weekSummary}
                findings={weekRows}
                currency={workspace.client.currency}
              />
            </div>
          </div>
        </Panel>
      </section>

      <section id="agencies" className={cn(m.container, s.wide)} aria-labelledby="agency-title">
        <div className={s.head}>
          <h2 id="agency-title" className={s.h2}>
            Every campaign, measured against its target.
          </h2>
          <p className={s.body}>
            Built for agencies running several clients. Switch client and every page follows,
            with that client’s currency, conversions and cost target.
          </p>
        </div>
        <Panel className={s.stackPanel}>
          <Wide>
            <ProductCrop source={1136} crop={CAMPAIGN_SUMMARY} label={summaryLabel}>
              <CampaignsPageCanvas evidence={evidence} />
            </ProductCrop>
            <div className={s.stackRule} />
            <ProductCrop
              source={1136}
              crop={CAMPAIGN_LEDGER}
              fade="bottom"
              label="The campaign ledger: Autumn Reset Sale spend £1,805 up 31.4%, 13 purchases down 43.5%, £138.83 per purchase, £110.83 over target; Retinol Renewal Serum £1,784, 82 purchases, £21.76, £6.24 under target; Vitamin C Brightening £1,248, 24 purchases, £51.99, £23.99 over target; Anti-Ageing Collection £783, 40 purchases, £19.58, £8.42 under target."
            >
              <CampaignsPageCanvas evidence={evidence} />
            </ProductCrop>
          </Wide>
          <Compact>
            <ProductCrop
              source={375}
              crop={CAMPAIGN_SUMMARY_COMPACT}
              maxScale={1.15}
              label={summaryLabel}
            >
              <CampaignsPageCanvas evidence={evidence} />
            </ProductCrop>
          </Compact>
        </Panel>
        <ol id="how-it-works" className={s.steps} aria-label="How it works">
          <li>
            <span className={s.stepN}>1</span>
            <p>
              <b>Export</b> ad-level daily data from Meta Ads Manager.
            </p>
          </li>
          <li>
            <span className={s.stepN}>2</span>
            <p>
              <b>Import</b> the CSV into the client’s workspace.
            </p>
          </li>
          <li>
            <span className={s.stepN}>3</span>
            <p>
              <b>Read</b> what changed, before the call.
            </p>
          </li>
        </ol>
      </section>

      <section className={cn(m.container, s.centered)} aria-labelledby="ask-title">
        <div className={s.head}>
          <h2 id="ask-title" className={s.h2}>
            Ask the account a question.
          </h2>
          <p className={s.body}>
            Answers start from the data, and say so when the question’s premise doesn’t hold.
          </p>
        </div>
        <Panel className={s.askPanel}>
          <Wide>
            <ProductCrop source={720} crop={ASK} label={askLabel}>
              <AnswerExhibit question={CPA_QUESTION} answer={answer} />
            </ProductCrop>
          </Wide>
          <Compact>
            <ProductCrop source={375} crop={ASK_COMPACT} maxScale={1.15} label={askLabel}>
              <AnswerExhibit question={CPA_QUESTION} answer={answer} />
            </ProductCrop>
          </Compact>
        </Panel>
      </section>

      <section className={cn(m.container, s.wide)} aria-labelledby="creatives-title">
        <div className={s.head}>
          <h2 id="creatives-title" className={s.h2}>
            See which creatives are carrying the account.
          </h2>
          <p className={s.body}>
            Compare formats and individual creatives by spend, purchases and cost against
            target, side by side with last week.
          </p>
        </div>
        <Panel className={s.widePanel}>
          <Wide>
            <ProductCrop source={1136} crop={CREATIVES} label={creativesLabel}>
              <CreativesCanvas evidence={evidence} />
            </ProductCrop>
          </Wide>
          <Compact>
            <ProductCrop
              source={375}
              crop={CREATIVES_COMPACT}
              maxScale={1.15}
              fade="bottom"
              label={creativesLabel}
            >
              <CreativesCanvas evidence={evidence} />
            </ProductCrop>
          </Compact>
        </Panel>
      </section>

      <CtaBand />
    </>
  );
}

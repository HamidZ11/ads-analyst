import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { ExportGuide, FIRST_IMPORT_HREF, GettingStarted } from "./getting-started";
import type { OnboardingProgress } from "./progress";

export type EmptyPage =
  "overview" | "campaigns" | "creatives" | "insights" | "ask" | "report" | "clients";

interface EmptyCopy {
  title: string;
  /** What will appear on this page. */
  appears: string;
  /** What produces it. */
  source: string;
  action: string;
}

/**
 * What each page will show and what produces it (PRODUCT.md: placeholders
 * state what will appear and what produces it). No sample numbers.
 */
export const EMPTY_COPY: Record<EmptyPage, EmptyCopy> = {
  overview: {
    title: "Account performance will appear here",
    appears:
      "Spend, revenue, conversions, cost per conversion and ROAS for the selected client, each against the previous period and the client’s targets, with a daily chart and the campaigns that moved most.",
    source: "It is read from the daily ad rows of the client’s Meta Ads CSV export.",
    action: "Import a Meta Ads export",
  },
  campaigns: {
    title: "Campaigns will be listed here",
    appears:
      "Every campaign with its spend, conversions, cost per conversion against target, ROAS and CTR, and how each changed from the previous period.",
    source:
      "Campaigns, ad sets and ads are created from the names and IDs in a Meta Ads CSV export.",
    action: "Import a Meta Ads export",
  },
  creatives: {
    title: "Creatives will be ranked here",
    appears:
      "Each creative ranked by spend, conversions, cost or CTR, with its trend and the ads and campaigns that use it.",
    source:
      "Built from the ads in a Meta Ads CSV export. Exports carry no artwork, so creatives show a neutral placeholder.",
    action: "Import a Meta Ads export",
  },
  insights: {
    title: "Findings will appear here",
    appears:
      "What needs attention, where to scale and what to watch for the selected client: spend without conversions, cost and ROAS changes, creative fatigue, spend concentration and campaigns or ads worth scaling.",
    source:
      "Findings are computed from the imported daily figures by fixed rules, so each one shows the numbers behind it.",
    action: "Import a Meta Ads export",
  },
  ask: {
    title: "Ask questions about a client’s data",
    appears:
      "Questions such as “What changed from the previous period?” or “Where am I wasting spend?”, answered with the figures, tables and comparisons behind each answer.",
    source:
      "Answers are computed from the selected client’s imported Meta Ads data and nothing else.",
    action: "Import a Meta Ads export",
  },
  report: {
    title: "A report for your client will appear here",
    appears:
      "A printable document for the selected client and period: headline results against the previous period, day-by-day charts, what the rules found, the top campaigns and creatives, and your own note on what you’re doing next.",
    source:
      "Everything except your note is computed from the client’s imported Meta Ads data; the note is the only thing stored.",
    action: "Import a Meta Ads export",
  },
  clients: {
    title: "No clients yet",
    appears:
      "Each client you manage, with its source, targets and the days of data it holds. Selecting one changes every page.",
    source:
      "A client is created from its first Meta Ads CSV export: you name it and confirm its business type, timezone and currency while importing.",
    action: "Add your first client",
  },
};

const PAGE_TITLES: Record<EmptyPage, string> = {
  overview: "Overview",
  campaigns: "Campaigns",
  creatives: "Creatives",
  insights: "Insights",
  ask: "Ask Analyst",
  report: "Client report",
  clients: "Clients",
};

/**
 * The page's own sentence: what will appear, what produces it, and the one
 * next action, with the export steps collapsed beneath it.
 */
export function EmptyStatement({ page, action = true }: { page: EmptyPage; action?: boolean }) {
  const copy = EMPTY_COPY[page];
  return (
    <section aria-labelledby={`empty-${page}`} className="max-w-[640px]">
      <h2 id={`empty-${page}`} className="text-base font-medium tracking-[-0.01em] text-ink">
        {copy.title}
      </h2>
      <p className="mt-1.5 text-[13px] leading-5 text-ink-muted">{copy.appears}</p>
      <p className="mt-1.5 text-[13px] leading-5 text-ink-muted">{copy.source}</p>
      {action ? (
        <>
          <Link href={FIRST_IMPORT_HREF} className={buttonClasses("primary", "md", "mt-4")}>
            {copy.action}
          </Link>
          <ExportGuide />
        </>
      ) : null}
    </section>
  );
}

/**
 * An analysis page, or Clients, in a workspace with no clients yet. Insights,
 * where sign-in lands, also carries the getting-started checklist and leaves
 * the action to it, so the view keeps one primary button.
 */
export function EmptyWorkspace({
  page,
  workspaceName,
  progress,
}: {
  page: EmptyPage;
  workspaceName: string;
  progress: OnboardingProgress | null;
}) {
  return (
    <>
      <PageHeader title={PAGE_TITLES[page]} description={`${workspaceName} · no clients yet`} />
      {page === "insights" && progress ? (
        <div className="grid gap-10 xl:grid-cols-[minmax(0,720px)_minmax(0,1fr)] xl:gap-14">
          <GettingStarted progress={progress} />
          <div className="border-t border-border pt-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-10">
            <EmptyStatement page="insights" action={false} />
          </div>
        </div>
      ) : (
        <EmptyStatement page={page} />
      )}
    </>
  );
}

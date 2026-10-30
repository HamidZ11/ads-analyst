import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { supabaseSharedReportReader, type SharedReportLookup } from "@/data/supabase/share";
import { ClientReport } from "@/features/report/client-report";
import { PrintButton } from "@/features/report/print-button";
import { buildSharedReport, SHARE_TOKEN, shareDateLabel } from "@/features/report/share";
import { SharedNotice } from "@/features/report/shared-notice";
import { appMode } from "@/lib/supabase/config";
import { NOT_INDEXED } from "@/lib/site";

/**
 * A client report opened through a read-only share link (D-NEW-share-1). No
 * session and no app navigation: the token is the only key, and
 * public.shared_client_report the only thing it can open, returning one
 * client's rows for one period. Never indexed; the link's address is not sent
 * on as a referrer.
 */

type Params = { params: Promise<{ token: string }> };

/** The request's client address, for the per-visitor lookup allowance. */
async function visitor(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip")?.trim() || "unknown";
}

/** One lookup per request, shared by the metadata and the page. */
const lookup = cache(async (token: string): Promise<SharedReportLookup | "error"> => {
  const mode = appMode();
  // Links live in the database; the demo and an unconfigured build have none.
  if (mode.kind !== "supabase" || !SHARE_TOKEN.test(token)) return { status: "not_found" };
  try {
    return await supabaseSharedReportReader(mode.url, mode.publishableKey).lookup(
      token,
      await visitor(),
    );
  } catch (failure) {
    console.error(
      "[ad-analyst] shared report could not be loaded:",
      (failure as Error).message,
    );
    return "error";
  }
});

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const result = await lookup((await params).token);
  const title =
    result !== "error" && result.status === "ok"
      ? `${result.client.name} · performance report`
      : result !== "error" && result.status === "expired"
        ? "Link expired"
        : "Shared report";
  return { title, robots: NOT_INDEXED, referrer: "no-referrer" };
}

export default async function SharedReportPage({ params }: Params) {
  const result = await lookup((await params).token);
  if (result === "error")
    return (
      <SharedNotice title="This report couldn't load">
        Something went wrong on our side. Try again in a moment.
      </SharedNotice>
    );
  if (result.status === "not_found") notFound();
  if (result.status === "expired")
    return (
      <SharedNotice title="This link has expired">
        Ask the agency that sent it for a new link.
      </SharedNotice>
    );
  if (result.status === "rate_limited")
    return (
      <SharedNotice title="Too many requests">
        This address was opened too many times in a short while. Try again in a few minutes.
      </SharedNotice>
    );

  const report = buildSharedReport(result);
  if (!report) notFound();
  const { model } = report;
  return (
    <main id="main" className="min-h-dvh bg-surface px-4 py-6 sm:px-6 lg:px-8 print:p-0">
      <div className="mx-auto mb-6 flex max-w-[960px] flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-border pb-4 print:hidden">
        <p className="text-xs text-ink-muted">
          <span className="font-medium text-ink-secondary">Shared report, read only.</span> This
          link works until {shareDateLabel(report.expiresAt, result.client.timezone)}.
        </p>
        <PrintButton />
      </div>
      <ClientReport
        model={model}
        note={report.note ? { body: report.note, updatedAt: "" } : null}
        canSave={false}
        shared
      />
    </main>
  );
}

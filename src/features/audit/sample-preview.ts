import type { Finding } from "@/domain/insights";
import type { CurrencyCode } from "@/domain/types";
import { auditExport } from "./audit";
import { buildSampleCsv, SAMPLE_ACCOUNT_NAME, SAMPLE_ANCHOR, SAMPLE_FILE_NAME } from "./sample";

/**
 * What the audit finds in its own sample export, for the page's hero: the
 * same `auditExport` run "Try the sample export" makes in the browser, done
 * once on the server. The finding, its figures and its periods are the
 * rules' output for the sample file; nothing is written for the page.
 */
export interface SamplePreview {
  finding: Finding;
  accountName: string;
  currency: CurrencyCode;
  currentLabel: string;
  previousLabel: string;
}

let cached: SamplePreview | null | undefined;

export function samplePreview(): SamplePreview | null {
  if (cached !== undefined) return cached;
  // The sample's last day is "today": only dates after today are refused.
  const result = auditExport({
    bytes: new TextEncoder().encode(buildSampleCsv()),
    fileName: SAMPLE_FILE_NAME,
    today: SAMPLE_ANCHOR,
  });
  const report = result.ok ? result.report : null;
  // Spend with no conversions is the audit's headline; else the top finding.
  const finding =
    report?.findings.find((f) => f.detector === "zero_conversion_spend") ??
    report?.findings[0] ??
    null;
  cached =
    report && finding
      ? {
          finding,
          accountName: report.accountName ?? SAMPLE_ACCOUNT_NAME,
          currency: report.currency,
          currentLabel: report.periods.currentLabel,
          previousLabel: report.periods.previousLabel,
        }
      : null;
  return cached;
}

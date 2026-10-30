import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AuditPage, { metadata } from "@/app/(marketing)/audit/page";
import { DETECTOR_LABELS, formatInsightValue } from "@/domain/insights";
import { MARKETING_PAGES } from "@/features/marketing/seo";
import { auditExport, type AuditReport } from "./audit";
import { AuditReportView } from "./audit-report";
import { EXPORT_STEPS } from "./export-guide";
import { buildSampleCsv, SAMPLE_ACCOUNT_NAME } from "./sample";

/** Text as React writes it into HTML. */
const escaped = (text: string) =>
  text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;").replaceAll('"', "&quot;");

function sampleReport(): AuditReport {
  const result = auditExport({
    bytes: new TextEncoder().encode(buildSampleCsv()),
    fileName: "ad-analyst-sample-export.csv",
    today: "2026-10-30",
  });
  if (!result.ok) throw new Error(result.problem.detail);
  return result.report;
}

describe("the /audit page", () => {
  const html = renderToStaticMarkup(createElement(AuditPage));

  it("has its own title and description, and one h1", () => {
    expect(metadata.title).toEqual({ absolute: MARKETING_PAGES["/audit"].title });
    expect(metadata.description).toBe(MARKETING_PAGES["/audit"].description);
    expect(html.match(/<h1/g)?.length).toBe(1);
  });

  it("offers a CSV file input and the sample, with no form to submit", () => {
    expect(html).toMatch(/<input id="audit-file" type="file" accept="\.csv,text\/csv"/);
    expect(html).toContain('<label for="audit-file"');
    expect(html).toContain("Try the sample export");
    expect(html).toContain('href="/audit-sample.csv" download="ad-analyst-sample-export.csv"');
    expect(html).not.toContain("<form");
    expect(html).toContain("It isn’t uploaded, stored or shared");
  });

  it("explains how to export, step by step", () => {
    expect(html).toContain("How to export from Ads Manager");
    for (const step of EXPORT_STEPS) expect(html).toContain(escaped(step.title));
    expect(html).toContain("Breakdown › By time › Day");
    expect(html).toContain("Reports › Export table data");
  });
});

describe("the audit report", () => {
  const report = sampleReport();
  const html = renderToStaticMarkup(
    createElement(AuditReportView, {
      report,
      sample: true,
      onReset: () => {},
      onOutcome: () => {},
      onTargets: () => {},
    }),
  );
  const money = (value: number) => formatInsightValue(value, "money", report.currency);

  it("names the account, the period covered and that it is sample data", () => {
    expect(html).toContain(`>${escaped(SAMPLE_ACCOUNT_NAME)}<`);
    expect(html).toContain(report.file.label);
    expect(html).toContain("Sample data: generated from the Ad Analyst demo");
    expect(html).toContain(money(report.file.spend));
  });

  it("labels flagged spend as spend, from the rules' own figures", () => {
    expect(html).toContain("Spend on flagged campaigns");
    expect(html).toContain("On campaigns that need attention");
    expect(html).toContain("On campaigns with no purchases");
    expect(html).toContain("not an estimate of money lost");
    expect(html).toContain(money(report.spend.needsAttention));
    expect(html).toContain(money(report.spend.zeroConversion));
    expect(html).not.toMatch(/wasted £|£[\d,]+ wasted/i);
  });

  it("shows every finding with its evidence, and the campaign ledger", () => {
    for (const finding of report.findings) {
      expect(html).toContain(escaped(finding.headline));
      expect(html).toContain(escaped(finding.action));
    }
    expect(html).toContain("Why this was flagged");
    for (const row of report.campaigns) expect(html).toContain(`title="${escaped(row.name)}"`);
    expect(html).toContain(DETECTOR_LABELS.zero_conversion_spend);
    expect(html).toContain("<tfoot>");
    expect(html).toContain("Save as PDF");
  });
});

describe("the audit report's targets", () => {
  const report = sampleReport();
  const render = (targets: { targetCpa: number | null; targetRoas: number | null }) =>
    renderToStaticMarkup(
      createElement(AuditReportView, {
        report: { ...report, targets },
        sample: true,
        onReset: () => {},
        onOutcome: () => {},
        onTargets: () => {},
      }),
    );

  it("offers optional target inputs in the report's currency, empty by default", () => {
    const html = render({ targetCpa: null, targetRoas: null });
    expect(html).toContain(`Target CPA (${report.currency})`);
    expect(html).toContain("Target ROAS");
    expect(html).toContain("Apply targets");
    expect(html).toContain("No targets are set");
  });

  it("states the targets the rules used", () => {
    const html = render({ targetCpa: 20, targetRoas: 3 });
    expect(html).toContain(escaped(formatInsightValue(20, "cost", report.currency)));
    expect(html).toContain(formatInsightValue(3, "multiple", report.currency));
    expect(html).toContain("Judged with your targets");
    expect(html).not.toContain("No targets are set");
  });
});

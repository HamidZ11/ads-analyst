import { describe, expect, it } from "vitest";
import {
  AD_SET_LEVEL_HEADERS,
  CAMPAIGN_LEVEL_HEADERS,
  DAYS_14,
  ECOM_HEADERS,
  NOT_DAILY_HEADERS,
  RESULTS_ONLY_HEADERS,
  RESULT_TYPE_HEADERS,
  commaDecimal,
  dayFirst,
  ecommerceRows,
  inCurrency,
  mapAmounts,
  mapDates,
  mixedResultRows,
  notDailyRows,
  resultTypeRows,
  toDelimited,
  withTotalsRow,
} from "@/data/import/__fixtures__/meta-variants";
import { leadCsv, totalsOf } from "@/data/import/__fixtures__/meta-exports";
import type { Row } from "@/data/import/__fixtures__/meta-exports";
import { auditExport, type AuditResult } from "./audit";

const TODAY = "2026-10-30";
const run = (csv: string, outcomeColumn?: number): AuditResult =>
  auditExport({
    bytes: new TextEncoder().encode(csv),
    fileName: "export.csv",
    today: TODAY,
    outcomeColumn,
  });
const report = (csv: string) => {
  const result = run(csv);
  if (!result.ok) throw new Error(`${result.problem.title}: ${result.problem.detail}`);
  return result.report;
};
const problem = (csv: string) => {
  const result = run(csv);
  if (result.ok) throw new Error("expected the audit to stop");
  return result.problem;
};

describe("the audit report", () => {
  it("covers the file's dates and totals and compares its later half with its earlier half", () => {
    const r = report(toDelimited(ECOM_HEADERS, ecommerceRows()));
    const clean = totalsOf();
    expect(r.file.range).toEqual({ start: DAYS_14[0], end: DAYS_14.at(-1) });
    expect(r.file.label).toBe("17 Sep – 30 Sep 2026");
    expect(r.file.spend).toBeCloseTo(clean.spend, 6);
    expect(r.file.conversions).toBe(clean.conversions);
    expect(r.periods.current).toEqual({ start: "2026-09-24", end: "2026-09-30" });
    expect(r.periods.previous).toEqual({ start: "2026-09-17", end: "2026-09-23" });
    expect(r.currency).toBe("GBP");
    expect(r.vocabulary.plural).toBe("Purchases");
    expect(r.revenueTracked).toBe(true);
  });

  it("raises the rules' own findings and sums flagged spend from them, nothing else", () => {
    const r = report(toDelimited(ECOM_HEADERS, ecommerceRows()));
    const zero = r.findings.filter((f) => f.detector === "zero_conversion_spend");
    expect(zero.map((f) => f.entity.name)).toEqual([
      "Prospecting | Lookalike 3% | Night Cream",
    ]);
    expect(r.spend.zeroConversion).toBeCloseTo(zero[0].spendInvolved, 6);
    expect(r.spend.zeroConversionCampaigns).toBe(1);
    const attention = r.findings.filter(
      (f) => f.priority === "high" && f.entity.type === "campaign",
    );
    expect(r.spend.needsAttention).toBeCloseTo(
      attention.reduce((s, f) => s + f.spendInvolved, 0),
      6,
    );
    expect(r.spend.period).toBeCloseTo(r.totals.spend, 6);
    const row = r.campaigns.find((c) => c.name.includes("Lookalike"));
    expect(row?.finding?.detector).toBe("zero_conversion_spend");
    expect(r.campaigns.reduce((s, c) => s + c.spend, 0)).toBeCloseTo(r.totals.spend, 6);
  });

  it("reads a European semicolon export with a BOM, day-first dates and a totals row the same way", () => {
    const clean = report(toDelimited(ECOM_HEADERS, ecommerceRows()));
    const european = report(
      toDelimited(
        ECOM_HEADERS,
        mapDates(mapAmounts(withTotalsRow(ecommerceRows(), "Total"), commaDecimal), dayFirst),
        ";",
        { bom: true, eol: "\r\n" },
      ),
    );
    expect(european.file.spend).toBeCloseTo(clean.file.spend, 6);
    expect(european.findings.map((f) => f.id)).toEqual(clean.findings.map((f) => f.id));
  });

  it("counts Results when its Result indicator or Result type names one outcome", () => {
    const indicator = report(toDelimited(RESULTS_ONLY_HEADERS, ecommerceRows()));
    expect(indicator.outcome).toMatchObject({ header: "Results", kind: "purchase" });
    expect(indicator.revenueTracked).toBe(false);
    expect(indicator.file.conversions).toBe(totalsOf().conversions);
    const type = report(toDelimited(RESULT_TYPE_HEADERS, resultTypeRows()));
    expect(type.outcome.kind).toBe("purchase");
    expect(
      report(toDelimited(RESULT_TYPE_HEADERS, resultTypeRows("Leads (form)"))).vocabulary
        .plural,
    ).toBe("Leads");
  });

  it("uses lead vocabulary for a lead export and reads other account currencies", () => {
    const leads = report(leadCsv());
    expect(leads.vocabulary.plural).toBe("Leads");
    expect(leads.revenueTracked).toBe(false);
    for (const code of ["USD", "EUR"] as const) {
      const { headers, rows } = inCurrency(code);
      expect(report(toDelimited(headers, rows)).currency).toBe(code);
    }
  });

  it("lets the visitor choose between Purchases and Leads when the file has both", () => {
    const headers = [...ECOM_HEADERS, "Leads"];
    const rows = ecommerceRows().map((r) => ({ ...r, Leads: 1 }));
    const first = report(toDelimited(headers, rows));
    expect(first.outcomeOptions.map((o) => o.kind)).toEqual(["purchase", "lead"]);
    expect(first.outcome.kind).toBe("purchase");
    const leads = run(toDelimited(headers, rows), first.outcomeOptions[1].column);
    expect(leads.ok && leads.report.vocabulary.plural).toBe("Leads");
  });
});

describe("unsupported exports get a specific fix, never a generic error", () => {
  const cases: Array<[string, string, string, RegExp]> = [
    [
      "campaign level",
      toDelimited(CAMPAIGN_LEVEL_HEADERS, ecommerceRows()),
      "not_ad_level",
      /Ads tab/,
    ],
    [
      "ad set level",
      toDelimited(AD_SET_LEVEL_HEADERS, ecommerceRows()),
      "not_ad_level",
      /Ads tab/,
    ],
    [
      "no daily breakdown",
      toDelimited(NOT_DAILY_HEADERS, notDailyRows()),
      "file_issues",
      /Breakdown › By time › Day/,
    ],
    [
      "no date at all",
      toDelimited(
        NOT_DAILY_HEADERS.filter((h) => !h.startsWith("Reporting")),
        notDailyRows(),
      ),
      "not_daily",
      /Breakdown › By time › Day/,
    ],
    [
      "Results counting different events",
      toDelimited(RESULTS_ONLY_HEADERS, mixedResultRows()),
      "mixed_results",
      /Add the Purchases or Leads column/,
    ],
    [
      "Results without an indicator",
      toDelimited(
        RESULTS_ONLY_HEADERS.filter((h) => h !== "Result indicator"),
        ecommerceRows(),
      ),
      "results_unknown",
      /Result indicator column/,
    ],
    [
      "no conversion column",
      toDelimited(
        RESULTS_ONLY_HEADERS.filter((h) => !h.startsWith("Result")),
        ecommerceRows(),
      ),
      "no_outcome",
      /Columns menu/,
    ],
    [
      "no spend column",
      toDelimited(
        ECOM_HEADERS.filter((h) => h !== "Amount spent (GBP)"),
        ecommerceRows(),
      ),
      "no_spend",
      /Add the Amount spent column/,
    ],
    [
      "a short range",
      toDelimited(
        ECOM_HEADERS,
        ecommerceRows().filter((r: Row) => String(r.Day) <= DAYS_14[9]),
      ),
      "too_short",
      /at least 14/,
    ],
    [
      "another currency",
      toDelimited(inCurrency("AUD").headers, inCurrency("AUD").rows),
      "unsupported_currency",
      /GBP, USD and EUR/,
    ],
    ["not an export", "name,age\nAna,30\n", "not_meta", /Ads Manager/],
    ["an empty file", "", "unreadable", /empty/],
  ];

  it.each(cases)("%s", (_, csv, code, fix) => {
    const p = problem(csv);
    expect(p.code).toBe(code);
    expect(`${p.title} ${p.detail} ${p.issues?.map((i) => i.message).join(" ") ?? ""}`).toMatch(
      fix,
    );
  });

  it("asks for CSV when given an Excel workbook", () => {
    const result = auditExport({
      bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
      fileName: "Ads-report.xlsx",
      today: TODAY,
    });
    expect(!result.ok && result.problem).toMatchObject({ code: "spreadsheet" });
    expect(!result.ok && result.problem.detail).toContain("choose CSV");
  });

  it("reports the file's own problems with the rows they are on", () => {
    const rows = ecommerceRows();
    rows[3]["Amount spent (GBP)"] = "twelve";
    const p = problem(toDelimited(ECOM_HEADERS, rows));
    expect(p.code).toBe("file_issues");
    expect(p.issues?.[0]).toMatchObject({
      code: "invalid_spend",
      samples: [{ line: 5, value: "twelve" }],
    });
  });

  it("dates every short-range message from the file", () => {
    const p = problem(
      toDelimited(
        ECOM_HEADERS,
        ecommerceRows().filter((r: Row) => r.Day === DAYS_14[0]),
      ),
    );
    expect(p.title).toBe("This export covers one day");
    expect(p.detail).toContain("17 Sep 2026");
  });
});

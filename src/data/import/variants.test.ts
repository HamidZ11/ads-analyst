import { describe, expect, it } from "vitest";
import {
  DAYS_14,
  ECOM_HEADERS,
  ROAS_HEADERS,
  commaDecimal,
  dayFirst,
  ecommerceRows,
  groupedPoint,
  mapAmounts,
  mapDates,
  monthFirst,
  reportRangeRows,
  roasRows,
  toDelimited,
  withTotalsRow,
} from "./__fixtures__/meta-variants";
import { totalsOf } from "./__fixtures__/meta-exports";
import { parseCsv, type CsvTable } from "./csv";
import { inspectHeaders, outcomeFromIndicator, proposeMapping } from "./meta";
import { summarizeRows } from "./normalize";
import {
  detectDateOrder,
  detectDecimalMark,
  parseMoney,
  parseNumber,
  symbolCurrency,
  validateImport,
  type ImportTarget,
} from "./validate";

/* Real-world shapes of the Ads Manager export, run through the same pipeline
   as the signed-in import. Each must give exactly the clean export's totals. */

const TARGET: ImportTarget = {
  clientName: "Bloom Botanicals",
  currency: "GBP",
  businessType: "ecommerce",
  revenueTracked: true,
  existingAccountId: null,
  today: "2026-10-03",
};

const table = (csv: string): CsvTable => {
  const parsed = parseCsv(csv);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.table;
};

function check(csv: string) {
  const t = table(csv);
  const inspection = inspectHeaders(t.headers);
  const { mapping } = proposeMapping(inspection, "ecommerce");
  return validateImport(t, mapping, TARGET, inspection);
}

const clean = totalsOf();
function expectCleanTotals(result: ReturnType<typeof check>) {
  expect(result.issues.filter((i) => i.level === "error")).toEqual([]);
  const summary = summarizeRows(result.rows);
  expect(summary.spend).toBeCloseTo(clean.spend, 6);
  expect(summary.conversions).toBe(clean.conversions);
  expect(summary.revenue).toBeCloseTo(clean.revenue, 6);
  expect(summary.days).toBe(14);
  expect(summary.firstDate).toBe(DAYS_14[0]);
  expect(summary.lastDate).toBe(DAYS_14.at(-1));
}

describe("numbers as files write them", () => {
  it("reads decimal commas and dot or space grouping only when asked", () => {
    expect(parseNumber("1.234,56", "comma")).toBe(1234.56);
    expect(parseNumber("12,5", "comma")).toBe(12.5);
    expect(parseNumber("1234", "comma")).toBe(1234);
    expect(parseNumber("1 234,56", "comma")).toBe(1234.56);
    expect(parseNumber("1 234.56")).toBe(1234.56);
    expect(parseNumber("1 234,56")).toBe("invalid");
    expect(parseNumber("1.234,56")).toBe("invalid");
    expect(parseNumber("1,234.56", "comma")).toBe("invalid");
  });

  it("detects the decimal mark from values that can only be read one way", () => {
    const t = (cells: string[]) => ({
      headers: ["a"],
      rows: cells.map((c) => [c]),
      lines: [],
      delimiter: ";" as const,
    });
    expect(detectDecimalMark(t(["12,50", "1.234,00"]), [0])).toBe("comma");
    expect(detectDecimalMark(t(["12.50", "1,234.00"]), [0])).toBe("point");
    // "1,234" alone could be either: Ads Manager's own format wins.
    expect(detectDecimalMark(t(["1,234", "5"]), [0])).toBe("point");
    expect(detectDecimalMark(t(["12,50", "12.50"]), [0])).toBe("point");
  });

  it("strips a matching currency symbol before or after the amount", () => {
    expect(parseMoney("£1,234.56", "GBP")).toBe(1234.56);
    expect(parseMoney("-£5", "GBP")).toBe(-5);
    expect(parseMoney("12,50 €", "EUR", "comma")).toBe(12.5);
    expect(parseMoney("€12.50", "GBP")).toEqual({ symbol: "€" });
    expect(symbolCurrency(["£1.00", "", "£2.00"])).toBe("GBP");
    expect(symbolCurrency(["£1.00", "$2.00"])).toBe("mixed");
    expect(symbolCurrency(["1.00"])).toBeNull();
  });
});

describe("dates as files write them", () => {
  it("decides day-first or month-first from the whole column", () => {
    expect(detectDateOrder(DAYS_14)).toBe("ymd");
    expect(detectDateOrder(DAYS_14.map(dayFirst))).toBe("dmy");
    expect(detectDateOrder(DAYS_14.map(monthFirst))).toBe("mdy");
    // Every part is 12 or under, but only one reading keeps the days together.
    const early = ["2026-10-01", "2026-10-02", "2026-10-03"];
    expect(detectDateOrder(early.map(dayFirst))).toBe("dmy");
    expect(detectDateOrder(early.map(monthFirst))).toBe("mdy");
    expect(detectDateOrder(["05/05/2026"])).toBe("dmy");
    expect(detectDateOrder(["03/04/2026"])).toBeNull();
  });

  it("reads DD/MM/YYYY and MM/DD/YYYY exports to the same days", () => {
    expectCleanTotals(check(toDelimited(ECOM_HEADERS, mapDates(ecommerceRows(), dayFirst))));
    expectCleanTotals(check(toDelimited(ECOM_HEADERS, mapDates(ecommerceRows(), monthFirst))));
  });

  it("names an ambiguous date order instead of guessing", () => {
    const rows = ecommerceRows()
      .filter((r) => r.Day === DAYS_14[0])
      .map((r) => ({
        ...r,
        "Reporting starts": "03/04/2026",
        "Reporting ends": "03/04/2026",
        Day: "03/04/2026",
      }));
    const issue = check(toDelimited(ECOM_HEADERS, rows)).issues.find(
      (i) => i.code === "ambiguous_date",
    );
    expect(issue?.level).toBe("error");
    expect(issue?.message).toContain("“03/04/2026”");
  });

  it("takes Day as the row's date when the reporting range covers the whole report", () => {
    expectCleanTotals(check(toDelimited(ECOM_HEADERS, reportRangeRows())));
  });
});

describe("file shapes", () => {
  it("reads a UTF-8 BOM, semicolons, decimal commas and quoted grouped thousands", () => {
    const rows = mapAmounts(ecommerceRows(), commaDecimal);
    const csv = toDelimited(ECOM_HEADERS, rows, ";", { bom: true, eol: "\r\n" });
    expect(csv.startsWith("﻿Reporting starts;")).toBe(true);
    expectCleanTotals(check(csv));
  });

  it("reads quoted grouped thousands and currency symbols in a comma file", () => {
    const rows = mapAmounts(ecommerceRows(), (v) => `£${groupedPoint(v)}`).map((r) => ({
      ...r,
      Impressions: groupedPoint(String(r.Impressions)),
    }));
    const csv = toDelimited(ECOM_HEADERS, rows);
    expect(csv).toMatch(/"£?\d{1,3},\d{3}"/);
    expectCleanTotals(check(csv));
  });

  it("skips trailing totals rows, labelled or not, and blank rows", () => {
    for (const label of ["", "Total", "Results from 70 ads"]) {
      const csv = toDelimited(ECOM_HEADERS, withTotalsRow(ecommerceRows(), label));
      const result = check(`${csv},,,,\n\n`);
      expectCleanTotals(result);
      expect(result.issues.find((i) => i.code === "summary_row")?.count).toBe(1);
    }
  });

  it("never reads a ROAS column as conversion value", () => {
    const csv = toDelimited(ROAS_HEADERS, roasRows());
    const inspection = inspectHeaders(table(csv).headers);
    expect(inspection.revenues.map((c) => c.header)).toEqual([
      "Purchases conversion value (GBP)",
    ]);
    expectCleanTotals(check(csv));
  });
});

describe("Result indicator and Result type", () => {
  it("names the outcome each value counts", () => {
    expect(outcomeFromIndicator("actions:offsite_conversion.fb_pixel_purchase")).toBe(
      "purchase",
    );
    expect(outcomeFromIndicator("Website purchases")).toBe("purchase");
    expect(outcomeFromIndicator("actions:onsite_conversion.lead_grouped")).toBe("lead");
    expect(outcomeFromIndicator("Leads (form)")).toBe("lead");
    expect(outcomeFromIndicator("Link clicks")).toBeNull();
    expect(inspectHeaders(["Result type"]).columns[0].role).toEqual({
      kind: "field",
      field: "resultIndicator",
    });
  });
});

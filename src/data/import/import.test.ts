import { describe, expect, it } from "vitest";
import { snapshot } from "@/domain/metrics";
import type { Client } from "@/domain/types";
import {
  DAYS_14,
  ECOM_ADS,
  ECOM_HEADERS,
  altCsv,
  ecommerceCsv,
  ecommerceRows,
  leadCsv,
  toCsv,
  totalsOf,
} from "./__fixtures__/meta-exports";
import { decodeCsvBytes, parseCsv, type CsvTable } from "./csv";
import { sanitizeMapping } from "./fields";
import { inspectHeaders, normalizeHeader, proposeMapping } from "./meta";
import { mergeClientData, normalizeImport, summarizeRows } from "./normalize";
import {
  isSetupIssue,
  parseDate,
  parseMoney,
  parseNumber,
  validateImport,
  type ImportTarget,
} from "./validate";

const table = (csv: string): CsvTable => {
  const parsed = parseCsv(csv);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.table;
};

const TARGET: ImportTarget = {
  clientName: "Bloom Botanicals",
  currency: "GBP",
  businessType: "ecommerce",
  revenueTracked: true,
  existingAccountId: null,
  today: "2026-10-03",
};

function check(csv: string, target: Partial<ImportTarget> = {}) {
  const t = table(csv);
  const inspection = inspectHeaders(t.headers);
  const { mapping } = proposeMapping(inspection, target.businessType ?? "ecommerce");
  return {
    t,
    mapping,
    result: validateImport(t, mapping, { ...TARGET, ...target }, inspection),
  };
}

const codes = (result: { issues: { code: string }[] }) => result.issues.map((i) => i.code);

const CLIENT: Client = {
  id: "cli_bloom",
  agencyId: "agy_northstar",
  name: "Bloom Botanicals",
  type: "ecommerce",
  currency: "GBP",
  timezone: "Europe/London",
  targetCpa: 20,
  targetRoas: null,
  revenueTracked: true,
};

describe("CSV parsing", () => {
  it("handles quoted commas, escaped quotes and newlines inside quotes, with line numbers", () => {
    const t = table('a,b,c\n1,"x, y","say ""hi"""\n2,"two\nlines",z\n3,q,r\n');
    expect(t.headers).toEqual(["a", "b", "c"]);
    expect(t.rows).toEqual([
      ["1", "x, y", 'say "hi"'],
      ["2", "two\nlines", "z"],
      ["3", "q", "r"],
    ]);
    expect(t.lines).toEqual([2, 3, 5]);
  });

  it("accepts CRLF, LF and CR line endings, a BOM, and skips blank lines", () => {
    for (const eol of ["\r\n", "\n", "\r"]) {
      const t = table(`﻿Day,Spend${eol}2026-09-01,10${eol}${eol}2026-09-02,12${eol}`);
      expect(t.headers).toEqual(["Day", "Spend"]);
      expect(t.rows).toEqual([
        ["2026-09-01", "10"],
        ["2026-09-02", "12"],
      ]);
    }
  });

  it("keeps blank cells and detects semicolon and tab delimiters", () => {
    expect(table("a,b,c\n1,,3\n").rows[0]).toEqual(["1", "", "3"]);
    expect(table("a;b\n1;2\n").delimiter).toBe(";");
    expect(table("a\tb\n1\t2\n").rows[0]).toEqual(["1", "2"]);
  });

  it("refuses empty, header-only, binary, unterminated and oversized input", () => {
    const fail = (csv: string, limits?: Parameters<typeof parseCsv>[1]) => {
      const r = parseCsv(csv, limits);
      return r.ok ? null : r.error.code;
    };
    expect(fail("")).toBe("empty");
    expect(fail("Day,Spend\n")).toBe("no_rows");
    expect(fail("Day,Spend\n1,\u0000")).toBe("binary");
    expect(fail('Day,Spend\n"2026-09-01,10\n')).toBe("unterminated_quote");
    const limits = { maxBytes: 1000, maxRows: 2, maxColumns: 3, maxCellLength: 5 };
    expect(fail("a\n1\n2\n3\n", limits)).toBe("too_many_rows");
    expect(fail("a,b,c,d\n1,2,3,4\n", limits)).toBe("too_many_columns");
    expect(fail("a\n123456\n", limits)).toBe("cell_too_long");
    expect(fail("a\n" + "1\n".repeat(600), limits)).toBe("too_large");
  });

  it("decodes UTF-8 with or without BOM and UTF-16, and rejects invalid text", () => {
    const utf8 = new TextEncoder().encode("Day,Spend\n2026-09-01,10\n");
    expect(decodeCsvBytes(utf8)).toMatchObject({ ok: true });
    const bom = new Uint8Array([0xef, 0xbb, 0xbf, ...utf8]);
    expect(decodeCsvBytes(bom)).toEqual({ ok: true, text: "Day,Spend\n2026-09-01,10\n" });
    const utf16 = new Uint8Array([
      0xff,
      0xfe,
      ...[..."Day"].flatMap((c) => [c.charCodeAt(0), 0]),
    ]);
    expect(decodeCsvBytes(utf16)).toEqual({ ok: true, text: "Day" });
    expect(decodeCsvBytes(new Uint8Array([0x44, 0xff, 0xfe, 0xfd]))).toMatchObject({
      ok: false,
      error: { code: "encoding" },
    });
    expect(decodeCsvBytes(new Uint8Array(0))).toMatchObject({
      ok: false,
      error: { code: "empty" },
    });
    expect(
      decodeCsvBytes(new Uint8Array(20), {
        maxBytes: 10,
        maxRows: 1,
        maxColumns: 1,
        maxCellLength: 1,
      }),
    ).toMatchObject({ ok: false, error: { code: "too_large" } });
  });

  it("parses plain and grouped numbers and nothing else", () => {
    expect(parseNumber("1234.56")).toBe(1234.56);
    expect(parseNumber("1,234.56")).toBe(1234.56);
    expect(parseNumber(" 0 ")).toBe(0);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("—")).toBeNull();
    for (const bad of ["£12", "12,5", "1e5", "12%", "abc", "1.2.3"])
      expect(parseNumber(bad)).toBe("invalid");
    expect(parseNumber("-5")).toBe(-5);
  });

  it("parses ISO dates only", () => {
    expect(parseDate("2026-09-30")).toBe("2026-09-30");
    expect(parseDate("2026/09/30")).toBe("2026-09-30");
    for (const bad of ["30/09/2026", "09/30/2026", "2026-02-30", "Sep 30, 2026", ""])
      expect(parseDate(bad)).toBeNull();
  });
});

describe("header detection and mapping", () => {
  it("reads the currency from Meta's header suffix", () => {
    expect(normalizeHeader("Amount spent (GBP)")).toEqual({
      key: "amount spent",
      currency: "GBP",
    });
    expect(normalizeHeader("CPM (cost per 1,000 impressions) (USD)")).toEqual({
      key: "cpm cost per 1 000 impressions",
      currency: "USD",
    });
    // Lower-case suffixes are part of the name, not a currency code.
    expect(normalizeHeader("Clicks (all)")).toEqual({ key: "clicks all", currency: null });
  });

  it("recognises a Meta export and classifies its columns", () => {
    const inspection = inspectHeaders([...ECOM_HEADERS]);
    expect(inspection.likelyMeta).toBe(true);
    expect(inspection.dateMode).toBe("day");
    expect(inspection.headerCurrencies).toEqual(["GBP"]);
    expect(inspection.outcomes.map((c) => c.header)).toEqual(["Results", "Purchases"]);
    expect(inspection.revenues.map((c) => c.header)).toEqual([
      "Purchases conversion value (GBP)",
    ]);
    const notImported = inspection.columns
      .filter((c) => c.role.kind === "not_imported")
      .map((c) => c.header);
    expect(notImported).toEqual(
      expect.arrayContaining([
        "Reach",
        "Frequency",
        "CTR (link click-through rate)",
        "Cost per result (GBP)",
        "Reporting starts",
      ]),
    );
  });

  it("maps identity, delivery and metric fields and prefers the business type's outcome", () => {
    const inspection = inspectHeaders([...ECOM_HEADERS]);
    const headerOf = (m: Record<string, number | undefined>, k: string) => ECOM_HEADERS[m[k]!];
    const { mapping, outcomeNote } = proposeMapping(inspection, "ecommerce");
    expect(headerOf(mapping, "date")).toBe("Day");
    expect(headerOf(mapping, "reportingEnd")).toBe("Reporting ends");
    expect(headerOf(mapping, "spend")).toBe("Amount spent (GBP)");
    expect(headerOf(mapping, "clicks")).toBe("Link clicks");
    expect(headerOf(mapping, "conversions")).toBe("Purchases");
    expect(headerOf(mapping, "revenue")).toBe("Purchases conversion value (GBP)");
    expect(headerOf(mapping, "adStatus")).toBe("Ad delivery");
    expect(outcomeNote).toBeNull();
    // A lead-gen client is not handed Purchases, and Results is never chosen silently.
    const lead = proposeMapping(inspection, "lead_generation");
    expect(lead.mapping.conversions).toBeUndefined();
    expect(lead.outcomeNote).toMatch(/can count different events/);
    expect(lead.mapping.revenue).toBeUndefined();
  });

  it("proposes nothing when the only outcome belongs to another business type", () => {
    const inspection = inspectHeaders([
      "Day",
      "Ad name",
      "Amount spent (GBP)",
      "Impressions",
      "Link clicks",
      "Leads",
    ]);
    const { mapping, outcomeNote } = proposeMapping(inspection, "ecommerce");
    expect(mapping.conversions).toBeUndefined();
    expect(outcomeNote).toMatch(/matches this business type/);
  });

  it("maps alternative common labels", () => {
    const t = table(altCsv());
    const { mapping } = proposeMapping(inspectHeaders(t.headers), "ecommerce");
    const by = (k: keyof typeof mapping) => t.headers[mapping[k]!];
    expect([
      by("date"),
      by("campaignName"),
      by("adSetName"),
      by("adName"),
      by("currency"),
    ]).toEqual(["Date", "Campaign", "Ad set", "Ad", "Currency"]);
    expect([by("spend"), by("clicks"), by("conversions"), by("revenue")]).toEqual([
      "Spend",
      "Clicks (all)",
      "Website purchases",
      "Website purchases conversion value",
    ]);
  });

  it("rebuilds mappings from untrusted input using known fields only", () => {
    const input = JSON.parse(
      '{"spend": 2, "__proto__": {"polluted": 1}, "constructor": 3, "clicks": 99, "date": "1", "impressions": 1.5, "adId": 0}',
    );
    const mapping = sanitizeMapping(input, 10);
    expect(mapping).toEqual({ spend: 2, adId: 0 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(sanitizeMapping([1, 2], 10)).toEqual({});
    expect(sanitizeMapping(null, 10)).toEqual({});
  });
});

describe("validation", () => {
  it("accepts a normal ecommerce export with only the expected notes", () => {
    const { result } = check(ecommerceCsv());
    expect(result.errors).toBe(0);
    expect(result.rows).toHaveLength(DAYS_14.length * ECOM_ADS.length);
    expect(result.fileCurrency).toBe("GBP");
    expect(result.accountId).toBe("1234567890");
    // Blank purchases on the Lookalike ad are read as 0 and said so; creative has no column.
    expect(codes(result).sort()).toEqual(
      ["blank_conversions", "blank_revenue", "creative_per_ad"].sort(),
    );
    const totals = totalsOf();
    const sum = summarizeRows(result.rows);
    expect(sum.spend).toBeCloseTo(totals.spend, 6);
    expect(sum.conversions).toBe(totals.conversions);
    expect(sum.revenue).toBeCloseTo(totals.revenue, 6);
    expect([sum.campaigns, sum.adSets, sum.ads, sum.days]).toEqual([3, 4, 5, 14]);
  });

  it("accepts CRLF exports identically", () => {
    expect(check(ecommerceCsv("\r\n")).result.rows).toEqual(check(ecommerceCsv()).result.rows);
  });

  it("validates a lead-generation export without revenue", () => {
    const { result } = check(leadCsv(), {
      businessType: "lead_generation",
      revenueTracked: false,
    });
    expect(result.errors).toBe(0);
    expect(result.rows.every((r) => r.revenue === 0)).toBe(true);
    expect(codes(result)).toEqual(
      expect.arrayContaining(["status_inferred", "creative_per_ad"]),
    );
  });

  it("requires a value column for a client that records revenue, and ignores one for a client that does not", () => {
    const rows = ecommerceRows().map((row) => {
      const rest = { ...row };
      delete rest["Purchases conversion value (GBP)"];
      return rest;
    });
    const headers = ECOM_HEADERS.filter((h) => h !== "Purchases conversion value (GBP)");
    expect(codes(check(toCsv(headers, rows)).result)).toContain("missing_revenue");
    const ignored = check(ecommerceCsv(), { revenueTracked: false }).result;
    expect(ignored.errors).toBe(0);
    expect(codes(ignored)).toContain("revenue_ignored");
    expect(ignored.rows.every((r) => r.revenue === 0)).toBe(true);
  });

  it("reports malformed numbers with the count and representative rows", () => {
    const rows = ecommerceRows();
    // A decimal comma is genuinely ambiguous (12.5 or 125?), so it blocks.
    for (const i of [3, 9, 12, 20, 21, 22]) rows[i]["Amount spent (GBP)"] = "12,5";
    const { result } = check(toCsv(ECOM_HEADERS, rows));
    const issue = result.issues.find((i) => i.code === "invalid_spend")!;
    expect(issue.level).toBe("error");
    expect(issue.message).toBe("Spend isn't a number on 6 rows (column “Amount spent (GBP)”).");
    expect(issue.samples).toHaveLength(5);
    expect(issue.samples[0]).toEqual({ line: 5, value: "12,5" });
    expect(result.rows).toEqual([]);
  });

  it("refuses negative values, fractional counts, bad dates and multi-day rows", () => {
    const rows = ecommerceRows();
    rows[0].Impressions = -10;
    rows[1]["Link clicks"] = "3.5";
    rows[2].Day = "30/09/2026";
    rows[3]["Reporting ends"] = "2026-09-30";
    const found = codes(check(toCsv(ECOM_HEADERS, rows)).result);
    expect(found).toEqual(
      expect.arrayContaining([
        "negative_impressions",
        "fraction_clicks",
        "bad_date",
        "multi_day",
      ]),
    );
  });

  it("names missing identity and spreadsheet-rounded IDs", () => {
    const rows = ecommerceRows();
    for (let i = 0; i < 14; i += 1) {
      rows[i]["Ad ID"] = "";
      rows[i]["Ad name"] = "";
    }
    rows[20]["Campaign ID"] = "1.2021E+17";
    const result = check(toCsv(ECOM_HEADERS, rows)).result;
    expect(result.issues.find((i) => i.code === "missing_value_adId")?.message).toBe(
      "14 rows have no ad name or ID, so they can't be matched to an ad.",
    );
    expect(codes(result)).toContain("rounded_campaignId");
  });

  it("names missing required mappings", () => {
    const t = table(
      toCsv(
        ["Day", "Ad name", "Impressions"],
        [{ Day: "2026-09-01", "Ad name": "A", Impressions: 10 }],
      ),
    );
    const result = validateImport(
      t,
      proposeMapping(inspectHeaders(t.headers), "ecommerce").mapping,
      TARGET,
    );
    expect(codes(result)).toEqual(
      expect.arrayContaining([
        "missing_spend",
        "missing_clicks",
        "missing_conversions",
        "missing_campaignId",
        "missing_adSetId",
      ]),
    );
    expect(result.issues.find((i) => i.code === "missing_spend")?.message).toBe(
      "We couldn't find a column for Spend.",
    );
  });

  it("blocks mixed currencies, a currency that differs from the client, and unsupported currencies", () => {
    const t = table(altCsv("GBP").replace(/,GBP,/, ",USD,"));
    const mixed = validateImport(
      t,
      proposeMapping(inspectHeaders(t.headers), "ecommerce").mapping,
      TARGET,
    );
    expect(mixed.issues.find((i) => i.code === "mixed_currency")?.message).toBe(
      "This file contains more than one currency (USD and GBP), so it can't be imported as one account.",
    );
    expect(codes(check(altCsv("USD")).result)).toContain("currency_mismatch");
    expect(
      check(altCsv("USD")).result.issues.find((i) => i.code === "currency_mismatch")?.message,
    ).toBe("This file is in USD, but Bloom Botanicals uses GBP.");
    expect(codes(check(ecommerceCsv().replace(/\(GBP\)/g, "(AUD)")).result)).toContain(
      "unsupported_currency",
    );
    const headersMixed = ecommerceCsv().replace(
      "Purchases conversion value (GBP)",
      "Purchases conversion value (USD)",
    );
    expect(codes(check(headersMixed).result)).toContain("mixed_currency");
  });

  it("warns when the file states no currency", () => {
    const { result } = check(leadCsv().replace(/ \(GBP\)/g, ""), {
      businessType: "lead_generation",
      revenueTracked: false,
    });
    expect(result.errors).toBe(0);
    expect(result.issues.find((i) => i.code === "currency_assumed")?.message).toMatch(
      /read as GBP/,
    );
  });

  it("keeps one account per import and matches the client's connected account", () => {
    const rows = ecommerceRows();
    rows[5]["Account ID"] = "999";
    expect(codes(check(toCsv(ECOM_HEADERS, rows)).result)).toContain("multiple_accounts");
    expect(codes(check(ecommerceCsv(), { existingAccountId: "555" }).result)).toContain(
      "account_mismatch",
    );
    expect(check(ecommerceCsv(), { existingAccountId: "1234567890" }).result.errors).toBe(0);
  });

  it("refuses a Results column that counts more than one kind of event", () => {
    const rows = ecommerceRows();
    rows[0]["Result indicator"] = "actions:lead";
    const t = table(toCsv(ECOM_HEADERS, rows));
    const inspection = inspectHeaders(t.headers);
    const mapping = {
      ...proposeMapping(inspection, "ecommerce").mapping,
      conversions: t.headers.indexOf("Results"),
    };
    expect(codes(validateImport(t, mapping, TARGET, inspection))).toContain("mixed_results");
  });

  it("counts exact duplicate rows once, refuses conflicting ones, and sums breakdown rows", () => {
    const rows = ecommerceRows();
    const exact = check(toCsv(ECOM_HEADERS, [...rows, rows[0], rows[1]])).result;
    expect(exact.errors).toBe(0);
    expect(exact.issues.find((i) => i.code === "duplicate_rows")?.count).toBe(2);
    expect(summarizeRows(exact.rows).spend).toBeCloseTo(totalsOf().spend, 6);
    const conflict = { ...rows[0], Impressions: 1 };
    expect(codes(check(toCsv(ECOM_HEADERS, [...rows, conflict])).result)).toContain(
      "duplicate_conflict",
    );
    const headers = [...ECOM_HEADERS, "Age"];
    const split = rows.flatMap((r) => [
      { ...r, Age: "18-24", Impressions: Math.floor(Number(r.Impressions) / 2) },
      { ...r, Age: "25-34", Impressions: Math.ceil(Number(r.Impressions) / 2) },
    ]);
    const summed = check(toCsv(headers, split)).result;
    expect(codes(summed)).toContain("breakdown_summed");
    expect(summed.rows.reduce((s, r) => s + r.impressions, 0)).toBe(totalsOf().impressions);
  });

  it("keeps rows with zero impressions and clicks; derived ratios stay undefined, not zero", () => {
    const rows = ecommerceRows();
    Object.assign(rows[0], {
      Impressions: 0,
      "Link clicks": 0,
      "Amount spent (GBP)": "0.00",
      Purchases: "",
    });
    const { result } = check(toCsv(ECOM_HEADERS, rows));
    expect(result.errors).toBe(0);
    const zero = result.rows.find((r) => r.line === 2)!;
    const derived = snapshot([zero]).derived;
    expect([derived.ctr, derived.cpc, derived.cpm, derived.cpa, derived.roas]).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });

  it("cleans names and flags formula-like text", () => {
    const rows = ecommerceRows();
    rows[0]["Ad name"] = '=HYPERLINK("x")\u0007 ‮evil';
    const { result } = check(toCsv(ECOM_HEADERS, rows));
    expect(codes(result)).toContain("formula_like");
    expect(result.rows.find((r) => r.line === 2)!.ad.name).toBe('=HYPERLINK("x") evil');
  });
});

describe("normalisation and duplicate policy", () => {
  const rows = check(ecommerceCsv()).result.rows;

  it("creates the canonical hierarchy with client-namespaced, deterministic IDs", () => {
    const n = normalizeImport(rows, CLIENT, {
      externalId: "1234567890",
      name: "Bloom Botanicals",
    });
    expect([n.campaigns.length, n.adSets.length, n.ads.length, n.creatives.length]).toEqual([
      3, 4, 5, 5,
    ]);
    expect(n.dailyMetrics).toHaveLength(70);
    for (const e of [...n.campaigns, ...n.adSets, ...n.ads, ...n.creatives])
      expect(e.id.startsWith("cli_bloom_")).toBe(true);
    expect(
      normalizeImport(rows, CLIENT, { externalId: null, name: null }).ads.map((a) => a.id),
    ).toEqual(n.ads.map((a) => a.id));
    expect(n.adAccount).toMatchObject({
      externalId: "1234567890",
      platform: "meta",
      currency: "GBP",
    });
    const serum = n.campaigns.find((c) => c.name === "Prospecting | Broad | Spring Serum")!;
    expect(serum).toMatchObject({ objective: "sales", status: "active" });
    expect(n.adSets.filter((s) => s.campaignId === serum.id)).toHaveLength(2);
    expect(n.creatives[0]).toMatchObject({
      type: "unknown",
      thumbnail: { kind: "unavailable" },
      headline: "",
    });
    const metrics = snapshot(n.dailyMetrics);
    expect(metrics.totals.spend).toBeCloseTo(totalsOf().spend, 6);
    expect(metrics.derived.roas).toBeCloseTo(totalsOf().revenue / totalsOf().spend, 10);
  });

  it("infers status from last-day spend only when the export has no delivery column", () => {
    const lead = check(leadCsv(), { businessType: "lead_generation", revenueTracked: false })
      .result.rows;
    const lastDay = lead.filter(
      (r) => r.date === "2026-09-30" && r.ad.name === "Book Now – Video 10s",
    );
    lastDay.forEach((r) => (r.spend = 0));
    const n = normalizeImport(
      lead,
      { ...CLIENT, type: "lead_generation" },
      { externalId: null, name: null },
    );
    expect(n.ads.map((a) => [a.name, a.status]).sort()).toEqual([
      ["Book Now – Video 10s", "paused"],
      ["Consultation – Testimonial – Static", "active"],
    ]);
    expect(n.campaigns.every((c) => c.objective === null)).toBe(true);
  });

  it("does not double-count a repeated import and refreshes only the overlap", () => {
    const first = normalizeImport(rows, CLIENT, { externalId: "1234567890", name: null });
    const record = {
      id: "imp_1",
      source: "meta_csv" as const,
      importedAt: "2026-10-03T09:00:00.000Z",
      fileName: "a.csv",
      fileBytes: 1,
      rows: 70,
      firstDate: "2026-09-17",
      lastDate: "2026-09-30",
      accountExternalId: "1234567890",
      currency: "GBP" as const,
      outcomeColumn: "Purchases",
      revenueColumn: "Purchases conversion value (GBP)",
    };
    const one = mergeClientData(null, CLIENT, first, record);
    expect([one.daysAdded, one.daysReplaced]).toEqual([70, 0]);
    const again = mergeClientData(one.bundle, CLIENT, first, { ...record, id: "imp_2" });
    expect([again.daysAdded, again.daysReplaced]).toEqual([0, 70]);
    expect(again.bundle.dailyMetrics).toEqual(one.bundle.dailyMetrics);
    expect(again.bundle.source.imports.map((i) => i.id)).toEqual(["imp_2", "imp_1"]);

    // A second export covering 24–30 Sep plus 1–7 Oct, with higher spend: overlap replaced, new days added, earlier days kept.
    const later = Array.from({ length: 14 }, (_, i) =>
      new Date(Date.UTC(2026, 8, 24 + i)).toISOString().slice(0, 10),
    );
    const bumped = ECOM_ADS.map((a) => ({ ...a, spend: a.spend * 2 }));
    const t2 = table(toCsv(ECOM_HEADERS, ecommerceRows(bumped, later)));
    const second = normalizeImport(
      validateImport(
        t2,
        proposeMapping(inspectHeaders(t2.headers), "ecommerce").mapping,
        TARGET,
      ).rows,
      CLIENT,
      { externalId: "1234567890", name: null },
    );
    const merged = mergeClientData(one.bundle, CLIENT, second, { ...record, id: "imp_3" });
    expect([merged.daysAdded, merged.daysReplaced]).toEqual([35, 35]);
    expect(merged.bundle.dailyMetrics).toHaveLength(105);
    const spendOn = (date: string) =>
      merged.bundle.dailyMetrics
        .filter((m) => m.date === date)
        .reduce((s, m) => s + m.spend, 0);
    expect(spendOn("2026-09-17")).toBeCloseTo(
      ECOM_ADS.reduce(
        (s, a) => s + Number(ecommerceRows([a], ["2026-09-17"])[0]["Amount spent (GBP)"]),
        0,
      ),
      6,
    );
    expect(spendOn("2026-09-24")).toBeCloseTo(
      second.dailyMetrics
        .filter((m) => m.date === "2026-09-24")
        .reduce((s, m) => s + m.spend, 0),
      6,
    );
  });
});

describe("ISO dates", () => {
  it("accepts YYYY-MM-DD exactly as written", () => {
    expect(parseDate("2026-09-17")).toBe("2026-09-17");
    expect(parseDate("2026-09-18")).toBe("2026-09-18");
    expect(parseDate(" 2026-09-30 ")).toBe("2026-09-30");
    expect(parseDate("2028-02-29")).toBe("2028-02-29");
  });

  it("accepts every day of a multi-day export", () => {
    const { result } = check(ecommerceCsv());
    expect(result.issues.filter((i) => i.field === "date")).toEqual([]);
    expect([...new Set(result.rows.map((r) => r.date))].sort()).toEqual(DAYS_14);
  });

  it("ignores a time part and never shifts the day, whatever the timezone", () => {
    const before = process.env.TZ;
    try {
      for (const tz of [
        "Pacific/Kiritimati",
        "America/Los_Angeles",
        "Etc/GMT+12",
        "Asia/Tokyo",
        "UTC",
      ]) {
        process.env.TZ = tz;
        expect(parseDate("2026-09-17")).toBe("2026-09-17");
        expect(parseDate("2026-09-17 00:00:00")).toBe("2026-09-17");
        expect(parseDate("2026-09-17T23:30:00-08:00")).toBe("2026-09-17");
        expect(parseDate("2026-09-18T00:00:00Z")).toBe("2026-09-18");
      }
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });

  it("still rejects dates that are not real or not ISO", () => {
    for (const bad of [
      "2026-02-30",
      "2026-13-01",
      "2026-9-17",
      "17/09/2026",
      "09/17/2026",
      "17 Sep 2026",
      "2026-09-17x",
      "",
    ])
      expect(parseDate(bad)).toBeNull();
    const rows = ecommerceRows();
    rows[0].Day = "2026-02-30";
    const issue = check(toCsv(ECOM_HEADERS, rows)).result.issues.find(
      (i) => i.code === "bad_date",
    );
    expect(issue).toMatchObject({
      level: "error",
      field: "date",
      count: 1,
      samples: [{ line: 2, value: "2026-02-30" }],
    });
    expect(issue?.message).toBe("We couldn't read the date on 1 row.");
  });

  it("reports a number field pointed at the Day column as a column choice, not as bad dates", () => {
    // The manual-review bug: Primary conversion left on the first column (Day)
    // produced "28 rows contain invalid Day values" for perfectly valid dates.
    const t = table(leadCsv());
    const inspection = inspectHeaders(t.headers);
    const mapping = {
      ...proposeMapping(inspection, "lead_generation").mapping,
      conversions: t.headers.indexOf("Day"),
    };
    const result = validateImport(
      t,
      mapping,
      { ...TARGET, businessType: "lead_generation", revenueTracked: false },
      inspection,
    );
    expect(codes(result)).toEqual(["wrong_column_conversions"]);
    const issue = result.issues[0];
    expect(issue).toMatchObject({
      level: "error",
      field: "conversions",
      count: 0,
      samples: [],
    });
    expect(issue.message).toBe(
      "Primary conversion is set to “Day”, which holds dates, not numbers. Choose the column with the primary conversion figures.",
    );
    expect(isSetupIssue(issue)).toBe(true);
    expect(
      result.issues.some(
        (i) => /invalid|Day values/.test(i.message) && i.code !== "wrong_column_conversions",
      ),
    ).toBe(false);
  });

  it("reports a date field pointed at a text column as a column choice", () => {
    const t = table(leadCsv());
    const inspection = inspectHeaders(t.headers);
    const mapping = {
      ...proposeMapping(inspection, "lead_generation").mapping,
      date: t.headers.indexOf("Campaign name"),
    };
    const result = validateImport(
      t,
      mapping,
      { ...TARGET, businessType: "lead_generation", revenueTracked: false },
      inspection,
    );
    expect(codes(result)).toEqual(["wrong_column_date"]);
    expect(isSetupIssue(result.issues[0])).toBe(true);
  });
});

describe("resolve safely, block only genuine uncertainty", () => {
  it("accepts amounts carrying the import's own currency symbol", () => {
    expect(parseMoney("£12.50", "GBP")).toBe(12.5);
    expect(parseMoney("£1,234.50", "GBP")).toBe(1234.5);
    expect(parseMoney("12.50", "GBP")).toBe(12.5);
    expect(parseMoney("$12.50", "GBP")).toEqual({ symbol: "$" });
    const rows = ecommerceRows();
    rows[3]["Amount spent (GBP)"] = "£" + rows[3]["Amount spent (GBP)"];
    const { result } = check(toCsv(ECOM_HEADERS, rows));
    expect(result.errors).toBe(0);
    expect(summarizeRows(result.rows).spend).toBeCloseTo(totalsOf().spend, 6);
  });

  it("blocks an amount in a different currency's symbol", () => {
    const rows = ecommerceRows();
    rows[3]["Amount spent (GBP)"] = "$40.00";
    const issue = check(toCsv(ECOM_HEADERS, rows)).result.issues.find(
      (i) => i.code === "symbol_spend",
    );
    expect(issue?.message).toBe("Spend on 1 row is shown in $, but this import is in GBP.");
  });

  it("skips a total row with no date or campaign", () => {
    const rows = ecommerceRows();
    const total: Record<string, string | number> = {
      "Amount spent (GBP)": "2387.00",
      Impressions: 251000,
    };
    const { result } = check(toCsv(ECOM_HEADERS, [...rows, total]));
    expect(result.errors).toBe(0);
    expect(result.issues.find((i) => i.code === "summary_row")).toMatchObject({
      level: "warning",
      count: 1,
    });
    expect(summarizeRows(result.rows).spend).toBeCloseTo(totalsOf().spend, 6);
  });

  it("lets a warning-only import proceed with its rows", () => {
    const { result } = check(leadCsv(), {
      businessType: "lead_generation",
      revenueTracked: false,
    });
    expect(result.errors).toBe(0);
    expect(result.warnings).toBeGreaterThan(0);
    expect(result.rows.length).toBe(28);
    expect(result.issues.every((i) => i.level === "warning")).toBe(true);
  });

  it("keeps genuine blockers as blockers", () => {
    const negative = ecommerceRows();
    negative[0].Impressions = -1;
    expect(check(toCsv(ECOM_HEADERS, negative)).result.errors).toBeGreaterThan(0);
    expect(
      check(altCsv("GBP").replace(/,GBP,/, ",USD,")).result.issues.find(
        (i) => i.code === "mixed_currency",
      )?.level,
    ).toBe("error");
    const conflict = ecommerceRows();
    expect(
      check(
        toCsv(ECOM_HEADERS, [...conflict, { ...conflict[0], Impressions: 1 }]),
      ).result.issues.find((i) => i.code === "duplicate_conflict")?.level,
    ).toBe("error");
  });
});

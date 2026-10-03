import { describe, expect, it } from "vitest";
import {
  ECOM_HEADERS,
  ecommerceCsv,
  ecommerceRows,
  leadCsv,
  toCsv,
} from "@/data/import/__fixtures__/meta-exports";
import { IMPORT_FIELDS, parseCsv, validateImport, type CsvTable } from "@/data/import";
import {
  ADVANCED_FIELDS,
  columnOptions,
  mappingStatus,
  prepareImport,
  requiredGaps,
} from "./setup";

const table = (csv: string): CsvTable => {
  const parsed = parseCsv(csv);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.table;
};
const target = {
  clientName: "New client",
  currency: "GBP" as const,
  existingAccountId: null,
  today: "2026-10-03",
};

describe("review setup needs almost nothing for a normal Meta export", () => {
  it("recognises an ecommerce export and maps every required field without confirmation", () => {
    const t = table(ecommerceCsv());
    const setup = prepareImport(t);
    expect(setup.suggestedType).toBe("ecommerce");
    expect(requiredGaps(setup.mapping)).toEqual([]);
    expect(mappingStatus(setup.mapping)).toMatchObject({ missing: [] });
    expect(mappingStatus(setup.mapping).label).toMatch(
      /^All required fields matched automatically/,
    );
    expect(setup.detected).toMatchObject({
      likelyMeta: true,
      currency: "GBP",
      firstDate: "2026-09-17",
      lastDate: "2026-09-30",
      days: 14,
      rows: 70,
      campaigns: 3,
      adSets: 4,
      ads: 5,
      daily: true,
    });
    const headerOf = (k: keyof typeof setup.mapping) => t.headers[setup.mapping[k]!];
    expect([
      headerOf("date"),
      headerOf("spend"),
      headerOf("impressions"),
      headerOf("clicks"),
      headerOf("conversions"),
      headerOf("revenue"),
    ]).toEqual([
      "Day",
      "Amount spent (GBP)",
      "Impressions",
      "Link clicks",
      "Purchases",
      "Purchases conversion value (GBP)",
    ]);
    // With only a client name supplied, the proposed setup validates cleanly.
    const result = validateImport(
      t,
      setup.mapping,
      { ...target, businessType: setup.businessType, revenueTracked: true },
      setup.inspection,
    );
    expect(result.errors).toBe(0);
  });

  it("suggests lead generation from a Leads column and maps it, with no value column", () => {
    const setup = prepareImport(table(leadCsv()));
    expect(setup.suggestedType).toBe("lead_generation");
    expect(setup.businessType).toBe("lead_generation");
    expect(requiredGaps(setup.mapping)).toEqual([]);
    expect(setup.mapping.revenue).toBeUndefined();
    expect(setup.detected).toMatchObject({
      currency: "GBP",
      rows: 28,
      campaigns: 2,
      outcomeHeaders: ["Leads"],
      revenueHeaders: [],
    });
  });

  it("keeps an existing client's business type when importing into it", () => {
    const setup = prepareImport(table(ecommerceCsv()), "lead_generation");
    expect(setup.businessType).toBe("lead_generation");
    expect(setup.mapping.conversions).toBeUndefined();
  });
});

describe("ambiguity and missing columns", () => {
  it("forces a choice when the only outcome is a generic Results column", () => {
    const headers = ECOM_HEADERS.filter(
      (h) => h !== "Purchases" && h !== "Purchases conversion value (GBP)",
    );
    const t = table(toCsv(headers, ecommerceRows()));
    const setup = prepareImport(t);
    expect(setup.suggestedType).toBeNull();
    expect(setup.mapping.conversions).toBeUndefined();
    expect(requiredGaps(setup.mapping)).toEqual(["conversions"]);
    expect(setup.outcomeNote).toMatch(/“Results” can count different events/);
    // Results is still offered first.
    expect(
      t.headers[columnOptions("conversions", setup.kinds, setup.inspection, undefined)[0]],
    ).toBe("Results");
  });

  it("does not guess a business type when the export has both purchases and leads", () => {
    const t = table(
      toCsv(
        [...ECOM_HEADERS, "Leads"],
        ecommerceRows().map((r) => ({ ...r, Leads: 1 })),
      ),
    );
    const setup = prepareImport(t);
    expect(setup.suggestedType).toBeNull();
    expect(t.headers[setup.mapping.conversions!]).toBe("Purchases");
  });

  it("does not block on missing optional columns", () => {
    const headers = [
      "Day",
      "Campaign name",
      "Ad set name",
      "Ad name",
      "Amount spent (GBP)",
      "Impressions",
      "Link clicks",
      "Leads",
    ];
    const rows = ecommerceRows().map((r) => ({
      Day: r.Day,
      "Campaign name": r["Campaign name"],
      "Ad set name": r["Ad set name"],
      "Ad name": r["Ad name"],
      "Amount spent (GBP)": r["Amount spent (GBP)"],
      Impressions: r.Impressions,
      "Link clicks": r["Link clicks"],
      Leads: r.Purchases,
    }));
    const t = table(toCsv(headers, rows));
    const setup = prepareImport(t);
    expect(requiredGaps(setup.mapping)).toEqual([]);
    const result = validateImport(
      t,
      setup.mapping,
      { ...target, businessType: "lead_generation", revenueTracked: false },
      setup.inspection,
    );
    expect(result.errors).toBe(0);
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["ids_missing", "status_inferred", "creative_per_ad"]),
    );
  });

  it("reports a missing required column in the advanced mapping status", () => {
    const headers = ECOM_HEADERS.filter((h) => h !== "Impressions");
    const setup = prepareImport(table(toCsv(headers, ecommerceRows())));
    expect(mappingStatus(setup.mapping)).toMatchObject({
      missing: ["impressions"],
      label: "1 required field needs a column",
    });
  });
});

describe("advanced mapping stays available", () => {
  const t = table(ecommerceCsv());
  const setup = prepareImport(t);
  const names = (field: Parameters<typeof columnOptions>[0]) =>
    columnOptions(field, setup.kinds, setup.inspection, setup.mapping[field]).map(
      (i) => t.headers[i],
    );

  it("covers every field except the two shown in setup", () => {
    expect(ADVANCED_FIELDS.map((f) => f.key)).toEqual(
      IMPORT_FIELDS.map((f) => f.key).filter((k) => k !== "conversions" && k !== "revenue"),
    );
  });

  it("offers only columns that can hold each field", () => {
    expect(names("spend")).toContain("Amount spent (GBP)");
    expect(names("spend")).not.toContain("Day");
    expect(names("spend")).not.toContain("Campaign name");
    expect(names("date")).toEqual(["Reporting starts", "Reporting ends", "Day"]);
    expect(names("campaignName")).toHaveLength(ECOM_HEADERS.length);
    expect(names("revenue")[0]).toBe("Purchases conversion value (GBP)");
    // IDs, other metrics, ratios and value columns are never offered as conversions.
    expect(names("conversions")).toEqual(
      ["Purchases", "Results"].sort(
        (a, b) => names("conversions").indexOf(a) - names("conversions").indexOf(b),
      ),
    );
    expect(names("conversions")).not.toContain("Campaign ID");
    expect(names("conversions")).not.toContain("Amount spent (GBP)");
    expect(names("conversions")).not.toContain("CTR (link click-through rate)");
  });

  it("keeps the current choice even when it does not fit", () => {
    const day = t.headers.indexOf("Day");
    expect(columnOptions("conversions", setup.kinds, setup.inspection, day)[0]).toBe(day);
  });
});

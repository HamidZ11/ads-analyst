import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { auditExport } from "./audit";
import { buildSampleCsv, SAMPLE_ACCOUNT_NAME, SAMPLE_DAYS, SAMPLE_PATH } from "./sample";

const file = path.join(process.cwd(), "public", SAMPLE_PATH);

describe("audit sample export", () => {
  it("is the committed file, generated from the seed (UPDATE_AUDIT_SAMPLE=1 rewrites it)", () => {
    const csv = buildSampleCsv();
    if (process.env.UPDATE_AUDIT_SAMPLE) writeFileSync(file, csv);
    expect(readFileSync(file, "utf8")).toBe(csv);
  });

  it("says it is sample data and audits cleanly, with findings from the rules", () => {
    const csv = buildSampleCsv();
    expect(csv).toContain(SAMPLE_ACCOUNT_NAME);
    const result = auditExport({
      bytes: new TextEncoder().encode(csv),
      fileName: "sample.csv",
      today: "2026-10-30",
    });
    if (!result.ok) throw new Error(result.problem.detail);
    const { report } = result;
    expect(report.accountName).toBe(SAMPLE_ACCOUNT_NAME);
    expect(report.file.span).toBe(SAMPLE_DAYS);
    expect(report.periods.days).toBe(7);
    expect(report.findings.map((f) => f.detector)).toContain("zero_conversion_spend");
    expect(report.spend.zeroConversion).toBeGreaterThan(0);
  });
});

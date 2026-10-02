import { describe, expect, it } from "vitest";
import {
  formatChange,
  formatCurrency,
  formatDateRange,
  formatMetric,
  formatMultiple,
  formatNumber,
  formatPercent,
} from "./format";

describe("formatting", () => {
  it("formats currency per client currency, compact when asked", () => {
    expect(formatCurrency(1234.5, "GBP")).toBe("£1,235");
    expect(formatCurrency(1234.5, "GBP", { decimals: 2 })).toBe("£1,234.50");
    expect(formatCurrency(12450, "GBP", { compact: true })).toBe("£12.5k");
    expect(formatCurrency(3_200_000, "USD", { compact: true })).toBe("$3.2M");
    expect(formatCurrency(null, "USD")).toBe("—");
  });

  it("formats counts, percentages and multiples", () => {
    expect(formatNumber(98765)).toBe("98,765");
    expect(formatNumber(98765, { compact: true })).toBe("98.8k");
    expect(formatPercent(0.0213, 2)).toBe("2.13%");
    expect(formatMultiple(3.5)).toBe("3.50x");
    expect(formatMultiple(null)).toBe("—");
  });

  it("formats signed changes with a true minus sign", () => {
    expect(formatChange(0.124)).toBe("+12.4%");
    expect(formatChange(-0.031)).toBe("−3.1%");
    expect(formatChange(0)).toBe("0.0%");
    expect(formatChange(null)).toBe("—");
  });

  it("formats metrics according to their definition", () => {
    expect(formatMetric("cpa", 15.9, "GBP")).toBe("£15.90");
    expect(formatMetric("ctr", 0.0192, "GBP")).toBe("1.92%");
    expect(formatMetric("roas", 4.63, "GBP")).toBe("4.63x");
    expect(formatMetric("conversions", 1234, "GBP")).toBe("1,234");
  });

  it("formats date ranges", () => {
    expect(formatDateRange({ start: "2026-09-26", end: "2026-10-02" })).toBe(
      "26 Sep – 2 Oct 2026",
    );
    expect(formatDateRange({ start: "2026-10-02", end: "2026-10-02" })).toBe("2 Oct 2026");
    expect(formatDateRange({ start: "2025-12-28", end: "2026-01-03" })).toBe(
      "28 Dec 2025 – 3 Jan 2026",
    );
  });
});

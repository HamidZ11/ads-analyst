import { describe, expect, it } from "vitest";
import {
  addDays,
  comparisonLabel,
  diffDays,
  eachDay,
  parseDatePreset,
  periodPairForPreset,
  previousRange,
  rangeForPreset,
  rangeLength,
  sliceByRange,
  todayInTimezone,
} from "./periods";

const ANCHOR = "2026-10-02";

describe("date arithmetic", () => {
  it("adds and subtracts days across month boundaries", () => {
    expect(addDays("2026-10-02", -2)).toBe("2026-09-30");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(diffDays("2026-09-25", "2026-10-02")).toBe(7);
  });

  it("enumerates every day in an inclusive range", () => {
    const days = eachDay({ start: "2026-09-28", end: "2026-10-02" });
    expect(days).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
    expect(rangeLength({ start: "2026-09-28", end: "2026-10-02" })).toBe(5);
  });

  it("resolves today in a timezone", () => {
    // 01:30 UTC on 3 Oct is still 2 Oct in New York but already 3 Oct in London (BST).
    const instant = new Date("2026-10-03T01:30:00Z");
    expect(todayInTimezone("America/New_York", instant)).toBe("2026-10-02");
    expect(todayInTimezone("Europe/London", instant)).toBe("2026-10-03");
  });
});

describe("presets", () => {
  it("maps presets to trailing windows ending at the anchor", () => {
    expect(rangeForPreset("today", ANCHOR)).toEqual({ start: ANCHOR, end: ANCHOR });
    expect(rangeForPreset("yesterday", ANCHOR)).toEqual({
      start: "2026-10-01",
      end: "2026-10-01",
    });
    expect(rangeForPreset("7d", ANCHOR)).toEqual({ start: "2026-09-26", end: ANCHOR });
    expect(rangeForPreset("14d", ANCHOR)).toEqual({ start: "2026-09-19", end: ANCHOR });
    expect(rangeForPreset("30d", ANCHOR)).toEqual({ start: "2026-09-03", end: ANCHOR });
  });

  it("derives an equally long, immediately preceding comparison period", () => {
    const current = rangeForPreset("7d", ANCHOR);
    const previous = previousRange(current);
    expect(previous).toEqual({ start: "2026-09-19", end: "2026-09-25" });
    expect(rangeLength(previous)).toBe(rangeLength(current));
    expect(addDays(previous.end, 1)).toBe(current.start);
  });

  it("falls back to the default preset for unknown or unavailable values", () => {
    expect(parseDatePreset(undefined)).toBe("7d");
    expect(parseDatePreset("nonsense")).toBe("7d");
    expect(parseDatePreset("custom")).toBe("7d");
    expect(parseDatePreset("30d")).toBe("30d");
  });

  it("labels the comparison baseline", () => {
    expect(comparisonLabel(periodPairForPreset("7d", ANCHOR))).toBe("previous 7 days");
    expect(comparisonLabel(periodPairForPreset("today", ANCHOR))).toBe("yesterday");
  });
});

describe("sliceByRange", () => {
  it("keeps rows inside the inclusive range only", () => {
    const rows = ["2026-09-25", "2026-09-26", "2026-10-02", "2026-10-03"].map((date) => ({
      date,
    }));
    const kept = sliceByRange(rows, rangeForPreset("7d", ANCHOR)).map((r) => r.date);
    expect(kept).toEqual(["2026-09-26", "2026-10-02"]);
  });
});

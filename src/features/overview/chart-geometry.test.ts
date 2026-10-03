import { describe, expect, it } from "vitest";
import {
  chartAxis,
  chartLabelIndexes,
  chartCoordinates,
  chartPaths,
  chartSeriesGeometry,
  type ChartPoint,
} from "./chart-geometry";

const points = (...values: (number | null)[]): ChartPoint[] =>
  values.map((value, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, value }));

describe("Overview chart geometry", () => {
  it("omits absent dates and deduplicates short-range axis labels", () => {
    expect(chartLabelIndexes(0)).toEqual([]);
    expect(chartLabelIndexes(1)).toEqual([0]);
    expect(chartLabelIndexes(2)).toEqual([0, 1]);
    expect(chartLabelIndexes(14)).toEqual([0, 6, 13]);
  });
  it.each([0.015, 3.5, 14, 1200, 15000])("uses a useful zero-based scale for %s", (peak) => {
    const axis = chartAxis([peak]);
    expect(axis.max).toBeGreaterThan(peak);
    expect(axis.max).toBeLessThanOrEqual(peak * 1.6);
    expect(axis.ticks.at(-1)).toBe(0);
    expect(axis.ticks.length).toBeLessThanOrEqual(5);
  });

  it("keeps empty, zero and invalid readings finite", () => {
    expect(chartAxis([]).max).toBe(1);
    expect(chartAxis([null, Number.NaN, Infinity, 0]).max).toBe(1);
    expect(chartCoordinates(points(null, Number.NaN, 0), 1).map((p) => p.y)).toEqual([
      null,
      null,
      320,
    ]);
  });

  it("does not label fractional conversions on a small count axis", () => {
    expect(chartAxis([1], 1).ticks.every(Number.isInteger)).toBe(true);
  });

  it("preserves gaps in the line AND the fill", () => {
    const paths = chartPaths(chartCoordinates(points(1, 2, null, 3, 2), 4));
    expect(paths.line.match(/M/g)).toHaveLength(2);
    expect(paths.area.match(/Z/g)).toHaveLength(2);
    expect(paths.line).not.toContain("NaN");
  });

  it("provides a visible marker rather than an invisible singleton move", () => {
    const paths = chartPaths(chartCoordinates(points(2), 4));
    expect(paths.isolated).toEqual([{ x: 500, y: 160 }]);
    expect(paths.area).toBe("");
  });

  it("aligns current and previous periods by day index and includes the target", () => {
    const g = chartSeriesGeometry({ current: points(2, 3), previous: points(3, 2) }, 4, false);
    expect(g.axis.max).toBeGreaterThan(4);
    expect(g.current.line).toMatch(/M0\.00 .*L1000\.00/);
    expect(g.previous.line).toMatch(/M0\.00 .*L1000\.00/);
  });

  it("shows earlier context and the actual final segment for a one-day selection", () => {
    const g = chartSeriesGeometry(
      { current: points(1, 2, 3, 2), previous: points(3) },
      null,
      true,
    );
    expect(g.current.line).toMatch(/^M666\.67 .*L1000\.00/);
    expect(g.previous.line).toMatch(/^M0\.00 .*L666\.67/);
    expect(g.current.line.match(/L/g)).toHaveLength(1);
  });

  it("does not bridge into a missing selected day", () => {
    const g = chartSeriesGeometry({ current: points(1, 2, null), previous: [] }, null, true);
    expect(g.current.line).not.toContain("L");
    expect(g.coordinates.at(-1)?.y).toBeNull();
  });
});

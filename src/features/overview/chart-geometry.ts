import type { IsoDate } from "@/domain/types";

export interface ChartPoint {
  date: IsoDate;
  value: number | null;
}
export interface ChartSeries {
  current: ChartPoint[];
  previous: ChartPoint[];
}
export const CHART_WIDTH = 1000;
export const CHART_HEIGHT = 320;

export function chartLabelIndexes(count: number) {
  return [...new Set([0, Math.floor((count - 1) / 2), count - 1])].filter(
    (i) => i >= 0 && i < count,
  );
}

/** Zero-based, at most four intervals, with modest headroom above data/target. */
export function chartAxis(values: readonly (number | null)[], minimumStep = 0) {
  const peak = Math.max(
    0,
    ...values.filter((v): v is number => v !== null && Number.isFinite(v)),
  );
  const ceiling = peak > 0 ? peak * 1.06 : 1;
  const exponent = Math.floor(Math.log10(ceiling));
  for (let e = exponent - 1; e <= exponent + 1; e++) {
    for (const factor of [1, 2, 2.5, 5]) {
      const step = factor * 10 ** e;
      if (step < minimumStep) continue;
      const count = Math.ceil(ceiling / step - 1e-9);
      if (count <= 4) {
        const max = step * count;
        return { max, ticks: Array.from({ length: count + 1 }, (_, i) => max - step * i) };
      }
    }
  }
  return { max: ceiling, ticks: [ceiling, ceiling / 2, 0] };
}

export function chartSeriesGeometry(
  series: ChartSeries,
  target: number | null,
  singleDay: boolean,
  minimumStep = 0,
) {
  const axis = chartAxis(
    [...series.current, ...series.previous].map((p) => p.value).concat(target),
    minimumStep,
  );
  const coordinates = chartCoordinates(series.current, axis.max);
  return {
    axis,
    coordinates,
    current: chartPaths(singleDay ? coordinates.slice(-2) : coordinates),
    previous: chartPaths(
      singleDay
        ? coordinates.slice(0, -1)
        : chartCoordinates(series.previous, axis.max, series.current.length),
    ),
  };
}

export function chartCoordinates(
  points: readonly ChartPoint[],
  max: number,
  count = points.length,
) {
  return points.map((point, index) => ({
    x: count <= 1 ? CHART_WIDTH / 2 : (index / (count - 1)) * CHART_WIDTH,
    y:
      point.value === null || !Number.isFinite(point.value)
        ? null
        : CHART_HEIGHT * (1 - Math.max(0, point.value) / max),
  }));
}
type Coordinate = ReturnType<typeof chartCoordinates>[number];

/** Keep missing readings as gaps, in both the stroke and its area. */
export function chartPaths(points: readonly Coordinate[]) {
  const segments: { x: number; y: number }[][] = [];
  let segment: { x: number; y: number }[] = [];
  for (const point of points) {
    if (point.y === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else segment.push({ x: point.x, y: point.y });
  }
  if (segment.length) segments.push(segment);
  const line = (s: { x: number; y: number }[]) =>
    s.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");
  return {
    line: segments.map(line).join(" "),
    area: segments
      .filter((s) => s.length > 1)
      .map((s) => `${line(s)} L${s.at(-1)!.x} ${CHART_HEIGHT} L${s[0].x} ${CHART_HEIGHT} Z`)
      .join(" "),
    isolated: segments.filter((s) => s.length === 1).flat(),
  };
}

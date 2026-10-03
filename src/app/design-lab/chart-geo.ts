/** Geometry only. Each concept draws its own markup from these numbers. */

export interface Pt {
  x: number;
  y: number;
}

/** Smallest "nice" axis (1/2/2.5/5 × 10ⁿ steps) that covers `value` in at most four intervals. */
export function niceAxis(value: number): { max: number; step: number; count: number } {
  const v = value > 0 ? value : 1;
  const base = Math.floor(Math.log10(v));
  for (let e = base - 1; e <= base + 1; e += 1) {
    const m = 10 ** e;
    for (const s of [1, 2, 2.5, 5]) {
      const step = s * m;
      const count = Math.ceil(v / step - 1e-9);
      if (count <= 4) return { max: step * count, step, count };
    }
  }
  return { max: v, step: v / 4, count: 4 };
}

/** Values to percent coordinates (x 0–100 across, y 0–100 down) against a 0..max axis. */
export function points(values: readonly number[], max: number): Pt[] {
  const n = values.length;
  return values.map((v, i) => ({
    x: n > 1 ? (i / (n - 1)) * 100 : 50,
    y: 100 - (Math.max(0, Math.min(v, max)) / max) * 100,
  }));
}

/** Smooth cubic path through the points, in a w×h viewBox. */
export function smoothPath(pts: readonly Pt[], w: number, h: number, tension = 0.17): string {
  if (pts.length === 0) return "";
  const P = pts.map((p) => ({ x: (p.x / 100) * w, y: (p.y / 100) * h }));
  let d = `M${P[0].x.toFixed(1)} ${P[0].y.toFixed(1)}`;
  const clampY = (y: number) => Math.max(0, Math.min(h, y));
  for (let i = 0; i < P.length - 1; i += 1) {
    const p0 = P[i - 1] ?? P[i];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) * tension, y: clampY(p1.y + (p2.y - p0.y) * tension) };
    const c2 = { x: p2.x - (p3.x - p1.x) * tension, y: clampY(p2.y - (p3.y - p1.y) * tension) };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export function areaPath(line: string, w: number, h: number): string {
  return `${line} L${w} ${h} L0 ${h} Z`;
}

export interface ChartSeriesInput {
  cur: readonly number[];
  pre: readonly number[];
  target: number | null;
}

export interface ChartGeo {
  w: number;
  h: number;
  max: number;
  ticks: Array<{ v: number; top: number }>;
  cur: { pts: Pt[]; line: string; area: string };
  pre: { pts: Pt[]; line: string };
  targetTop: number | null;
}

export function buildChart(input: ChartSeriesInput, w: number, h: number): ChartGeo {
  const peak = Math.max(...input.cur, ...input.pre, input.target ?? 0);
  const axis = niceAxis(peak * 1.06);
  const curPts = points(input.cur, axis.max);
  const prePts = points(input.pre, axis.max);
  const curLine = smoothPath(curPts, w, h);
  return {
    w,
    h,
    max: axis.max,
    ticks: Array.from({ length: axis.count + 1 }, (_, i) => {
      const v = axis.step * i;
      return { v, top: 100 - (v / axis.max) * 100 };
    }),
    cur: { pts: curPts, line: curLine, area: areaPath(curLine, w, h) },
    pre: { pts: prePts, line: smoothPath(prePts, w, h) },
    targetTop: input.target === null ? null : 100 - (input.target / axis.max) * 100,
  };
}

/** Tiny trend line normalised to its own range. */
export function spark(values: readonly number[], w: number, h: number, pad = 3) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => ({
    x: values.length > 1 ? (i / (values.length - 1)) * 100 : 50,
    y: ((h - pad * 2 - ((v - min) / span) * (h - pad * 2)) / h) * 100 + (pad / h) * 100,
  }));
  const line = smoothPath(pts, w, h, 0.15);
  const last = pts[pts.length - 1];
  return {
    line,
    area: areaPath(line, w, h),
    last: { x: (last.x / 100) * w, y: (last.y / 100) * h },
  };
}

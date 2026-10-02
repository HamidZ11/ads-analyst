import { formatDate } from "@/domain/format";
import type { IsoDate } from "@/domain/types";
import { cn } from "@/lib/cn";

export interface LinePoint {
  date: IsoDate;
  value: number | null;
}

export interface LineChartProps {
  points: readonly LinePoint[];
  /** Formats y-axis ticks. */
  formatValue: (value: number) => string;
  /** First date of the current period; earlier dates render in the muted hue. */
  currentStart?: IsoDate;
  height?: number;
  className?: string;
}

/** Round up to a clean axis maximum (1, 2, 2.5, 5 × 10^k). */
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return 10 * magnitude;
}

const VIEW_W = 1000;
const VIEW_H = 100;

function buildPath(points: readonly LinePoint[], max: number): { line: string; area: string } {
  const n = points.length;
  let line = "";
  let area = "";
  let segment: Array<{ x: number; y: number }> = [];

  const flush = () => {
    if (segment.length === 0) return;
    const first = segment[0];
    const last = segment[segment.length - 1];
    line +=
      segment
        .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(" ") + " ";
    area +=
      `M${first.x.toFixed(1)} ${VIEW_H} ` +
      segment.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") +
      ` L${last.x.toFixed(1)} ${VIEW_H} Z `;
    segment = [];
  };

  points.forEach((p, i) => {
    if (p.value === null || !Number.isFinite(p.value)) {
      flush();
      return;
    }
    const x = n === 1 ? VIEW_W / 2 : (i / (n - 1)) * VIEW_W;
    const y = VIEW_H - (Math.min(p.value, max) / max) * VIEW_H;
    segment.push({ x, y });
  });
  flush();
  return { line: line.trim(), area: area.trim() };
}

/**
 * Open, single-series line: hairline gridlines, quiet ticks, blue selected
 * period over a grey earlier period, an end marker on the latest value. The
 * interactive layer arrives in the charting phase.
 */
export function LineChart({
  points,
  formatValue,
  currentStart,
  height = 220,
  className,
}: LineChartProps) {
  const defined = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null && Number.isFinite(v));
  const max = niceCeil(Math.max(0, ...defined));
  const ticks = [max, max / 2, 0];
  const n = points.length;
  const splitIndex = currentStart ? points.findIndex((p) => p.date >= currentStart) : -1;
  const previous = splitIndex > 0 ? points.slice(0, splitIndex + 1) : [];
  const current = splitIndex > 0 ? points.slice(splitIndex) : points;
  const prevPath = buildPath(previous, max);
  const currPath = buildPath(current, max);
  const prevWidth = splitIndex > 0 && n > 1 ? (splitIndex / (n - 1)) * VIEW_W : 0;
  const currWidth = VIEW_W - prevWidth;
  const labelIndexes = n > 2 ? [0, Math.floor((n - 1) / 2), n - 1] : n === 2 ? [0, 1] : [0];
  const lastIndex = (() => {
    for (let i = n - 1; i >= 0; i--) if (points[i].value !== null) return i;
    return -1;
  })();
  const last = lastIndex >= 0 ? points[lastIndex] : null;
  const lastY =
    last && last.value !== null ? (1 - Math.min(last.value, max) / max) * 100 : null;
  const lastX = lastIndex >= 0 && n > 1 ? (lastIndex / (n - 1)) * 100 : 100;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-3">
        <div
          className="flex w-12 shrink-0 flex-col justify-between text-right text-2xs text-ink-faint tabular"
          style={{ height }}
        >
          {ticks.map((t) => (
            <span
              key={t}
              className="-translate-y-1/2 first:translate-y-0 last:-translate-y-full"
            >
              {formatValue(t)}
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((t, i) => (
              <div
                key={t}
                className={cn(
                  "h-px w-full",
                  i === ticks.length - 1 ? "bg-border" : "bg-chart-grid",
                )}
              />
            ))}
          </div>
          {splitIndex > 0 ? (
            <div
              aria-hidden
              className="absolute inset-y-0 right-0 border-l border-accent-border/70 bg-accent-soft/35"
              style={{ width: `${(currWidth / VIEW_W) * 100}%` }}
            />
          ) : null}
          <svg
            aria-hidden
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            preserveAspectRatio="none"
          >
            {previous.length > 1 ? (
              <>
                <path d={prevPath.area} fill="var(--color-chart-muted)" fillOpacity={0.1} />
                <path
                  d={prevPath.line}
                  fill="none"
                  stroke="var(--color-chart-muted)"
                  strokeWidth={1.75}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            ) : null}
            <path d={currPath.area} fill="var(--color-chart-primary)" fillOpacity={0.08} />
            <path
              d={currPath.line}
              fill="none"
              stroke="var(--color-chart-primary)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          {lastY !== null ? (
            <span
              aria-hidden
              className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-primary ring-2 ring-surface"
              style={{ left: `${lastX}%`, top: `${lastY}%` }}
            />
          ) : null}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-15 text-2xs text-ink-faint">
        {labelIndexes.map((i) => (
          <span key={points[i]?.date ?? i}>{points[i] ? formatDate(points[i].date) : ""}</span>
        ))}
      </div>
    </div>
  );
}

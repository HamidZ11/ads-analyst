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
  // Contiguous runs of defined points become separate sub-paths so gaps stay gaps.
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
 * Static single-series line with recessive gridlines. The interactive layer
 * (crosshair, tooltip, period selection) is added in the charting phase.
 */
export function LineChart({
  points,
  formatValue,
  currentStart,
  height = 168,
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

  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-2">
        <div
          className="flex shrink-0 flex-col justify-between py-0.5 text-right text-2xs text-ink-faint tabular"
          style={{ height }}
        >
          {ticks.map((t) => (
            <span key={t}>{formatValue(t)}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1" style={{ height }}>
          <div aria-hidden className="absolute inset-0 flex flex-col justify-between">
            {ticks.map((t) => (
              <div key={t} className="h-px w-full bg-chart-grid" />
            ))}
          </div>
          {splitIndex > 0 ? (
            <div
              aria-hidden
              className="absolute inset-y-0 right-0 bg-accent-soft/40"
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
                <path d={prevPath.area} fill="var(--color-chart-muted)" fillOpacity={0.12} />
                <path
                  d={prevPath.line}
                  fill="none"
                  stroke="var(--color-chart-muted)"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </>
            ) : null}
            <path d={currPath.area} fill="var(--color-chart-primary)" fillOpacity={0.1} />
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
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pl-10 text-2xs text-ink-faint">
        {labelIndexes.map((i) => (
          <span key={points[i]?.date ?? i}>{points[i] ? formatDate(points[i].date) : ""}</span>
        ))}
      </div>
    </div>
  );
}

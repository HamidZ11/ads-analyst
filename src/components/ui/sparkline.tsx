import { cn } from "@/lib/cn";

export interface SparklineProps {
  values: readonly (number | null)[];
  /** Index at which the current period begins; earlier points are de-emphasised. */
  splitIndex?: number;
  width?: number;
  height?: number;
  className?: string;
}

function buildPath(points: Array<[number, number] | null>): string {
  let d = "";
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)} `;
    pen = true;
  }
  return d.trim();
}

/** Tiny trend line for stat tiles and table rows. Decorative; values live in text. */
export function Sparkline({
  values,
  splitIndex,
  width = 88,
  height = 26,
  className,
}: SparklineProps) {
  const defined = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (defined.length < 2) {
    return (
      <span aria-hidden className={cn("inline-block", className)} style={{ width, height }} />
    );
  }
  const min = Math.min(...defined);
  const max = Math.max(...defined);
  const span = max - min || 1;
  const pad = 2.5;
  const n = values.length;
  const x = (i: number) => pad + (i / (n - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const coords = values.map<[number, number] | null>((v, i) =>
    v === null || !Number.isFinite(v) ? null : [x(i), y(v)],
  );
  const split = splitIndex === undefined ? 0 : Math.max(0, Math.min(n - 1, splitIndex));
  const previous = coords.slice(0, split + 1);
  const current = coords.slice(split);
  const last = [...coords].reverse().find((c) => c !== null);

  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
    >
      {split > 0 ? (
        <path
          d={buildPath(previous)}
          fill="none"
          stroke="var(--color-chart-muted)"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      <path
        d={buildPath(current)}
        fill="none"
        stroke="var(--color-chart-primary)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {last ? (
        <circle
          cx={last[0]}
          cy={last[1]}
          r={2.5}
          fill="var(--color-chart-primary)"
          stroke="var(--color-surface)"
          strokeWidth={1.5}
        />
      ) : null}
    </svg>
  );
}

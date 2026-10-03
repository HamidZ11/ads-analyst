import type { DailySeries } from "./evidence";

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * The texture inside the marketing cobalt field: one row per campaign, one
 * column per day, each cell the day's spend relative to that campaign's own
 * high. Seeded data, drawn soft. Decorative, so hidden from assistive tech.
 */
export function SpendField({
  series,
  blurred = false,
}: {
  series: DailySeries[];
  blurred?: boolean;
}) {
  const days = series[0]?.spend.length ?? 0;
  const rows = series.map((s) => {
    const max = Math.max(...s.spend, 1);
    return s.spend.map((v) => v / max);
  });
  return (
    <svg
      viewBox={`0 0 ${days} ${rows.length}`}
      preserveAspectRatio="none"
      className="absolute inset-0 block h-full w-full"
      aria-hidden
      style={blurred ? { filter: "blur(var(--field-blur))" } : undefined}
    >
      {rows.map((row, r) =>
        row.map((v, d) => (
          <rect
            key={`${r}-${d}`}
            x={d + (blurred ? 0 : 0.06)}
            y={r + (blurred ? 0 : 0.04)}
            width={blurred ? 1.02 : 0.88}
            height={blurred ? 1.02 : 0.92}
            fill="var(--field-hi)"
            fillOpacity={round(0.08 + v * 0.92)}
          />
        )),
      )}
    </svg>
  );
}

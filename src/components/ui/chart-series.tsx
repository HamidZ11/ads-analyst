/**
 * Stroke styles for period-over-period charts (Overview performance chart,
 * Insights finding charts, Creatives inspector daily spend): this period is a solid, darker blue line; the
 * previous period is a dashed grey line. Legends draw the same strokes.
 */

export const CURRENT_LINE = {
  stroke: "var(--color-chart-current)",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/* Butt caps keep the gaps open; round caps would fill them at this width. */
export const PREVIOUS_LINE = {
  stroke: "var(--color-chart-muted)",
  strokeWidth: 1.75,
  strokeDasharray: "5 4",
  strokeLinecap: "butt",
  strokeLinejoin: "round",
} as const;

/** A 14px legend sample of a series' line: solid, or two dashes. */
export function SeriesSwatch({ series }: { series: "current" | "previous" }) {
  return (
    <svg aria-hidden width="14" height="4" viewBox="0 0 14 4" className="shrink-0">
      <line
        x1="0"
        x2="14"
        y1="2"
        y2="2"
        {...(series === "current" ? CURRENT_LINE : PREVIOUS_LINE)}
      />
    </svg>
  );
}

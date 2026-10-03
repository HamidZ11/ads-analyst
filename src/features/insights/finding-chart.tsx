import { useId } from "react";
import { formatCurrency, formatDate, formatNumber } from "@/domain/format";
import { formatInsightValue, type InsightChart } from "@/domain/insights";
import type { CurrencyCode } from "@/domain/types";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  chartLabelIndexes,
  chartSeriesGeometry,
} from "@/features/overview/chart-geometry";
import { cn } from "@/lib/cn";

function tickLabel(value: number, format: InsightChart["format"], currency: CurrencyCode) {
  if (format === "money" || format === "cost")
    return formatCurrency(value, currency, {
      compact: true,
      decimals: Number.isInteger(value) ? 0 : 2,
    });
  if (format === "count")
    return formatNumber(value, { decimals: Number.isInteger(value) ? 0 : 1 });
  return formatInsightValue(value, format, currency);
}

/**
 * The Overview chart grammar at evidence size: the selected period in blue,
 * the previous period in grey aligned by day number, three or four ticks
 * from zero, the final value labelled. Static; the text summary carries the
 * same reading for assistive technology.
 */
export function FindingChart({
  chart,
  currency,
  currentLabel,
  previousLabel,
}: {
  chart: InsightChart;
  currency: CurrencyCode;
  currentLabel: string;
  previousLabel: string;
}) {
  const geometry = chartSeriesGeometry(
    { current: chart.current, previous: chart.previous },
    null,
    false,
    chart.format === "count" ? 1 : 0,
  );
  const end = geometry.coordinates.at(-1);
  const endValue = chart.current.at(-1)?.value ?? null;
  const labels = chartLabelIndexes(chart.current.length);
  const titleId = useId();

  return (
    <section aria-labelledby={titleId} className="mt-6 border-t border-border pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 id={titleId} className="text-xs font-medium text-ink-secondary">
          {chart.title}
        </h3>
        <ul aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-chart-primary" />
            {currentLabel}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 bg-chart-muted" />
            {previousLabel}
          </li>
        </ul>
      </div>
      <p className="sr-only">{chart.summary}</p>
      <div aria-hidden className="relative mt-4 mr-12 ml-12 h-[140px]">
        {geometry.axis.ticks.map((tick) => (
          <div
            key={tick}
            className="absolute inset-x-0"
            style={{ top: `${100 - (tick / geometry.axis.max) * 100}%` }}
          >
            <span className="absolute right-full mr-3 -translate-y-1/2 text-xs text-ink-muted tabular">
              {tickLabel(tick, chart.format, currency)}
            </span>
            <div className={cn("h-px", tick === 0 ? "bg-border-strong" : "bg-chart-grid")} />
          </div>
        ))}
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
          preserveAspectRatio="none"
        >
          <path
            d={geometry.current.area}
            fill="var(--color-chart-primary)"
            fillOpacity="0.04"
          />
          <path
            d={geometry.previous.line}
            fill="none"
            stroke="var(--color-chart-muted)"
            strokeWidth="1.75"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <path
            d={geometry.current.line}
            fill="none"
            stroke="var(--color-chart-primary)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        {[...geometry.previous.isolated, ...geometry.current.isolated].map((p, i) => (
          <span
            key={`${p.x}-${i}`}
            className={cn(
              "absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full",
              i < geometry.previous.isolated.length ? "bg-chart-muted" : "bg-chart-primary",
            )}
            style={{ left: `${p.x / 10}%`, top: `${(p.y / CHART_HEIGHT) * 100}%` }}
          />
        ))}
        {end && end.y !== null && endValue !== null ? (
          <>
            <span
              className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-primary ring-2 ring-surface"
              style={{ left: `${end.x / 10}%`, top: `${(end.y / CHART_HEIGHT) * 100}%` }}
            />
            <span
              className="absolute left-full ml-2 -translate-y-1/2 text-xs font-semibold whitespace-nowrap text-ink tabular"
              style={{ top: `${(end.y / CHART_HEIGHT) * 100}%` }}
            >
              {formatInsightValue(endValue, chart.format, currency)}
            </span>
          </>
        ) : null}
      </div>
      <div aria-hidden className="relative mt-2 mr-12 ml-12 h-4 text-xs text-ink-muted tabular">
        {labels.map((i) => (
          <span
            key={i}
            className="absolute whitespace-nowrap"
            style={{
              left: `${geometry.coordinates[i].x / 10}%`,
              transform: `translateX(${i === 0 ? "0" : i === chart.current.length - 1 ? "-100%" : "-50%"})`,
            }}
          >
            {formatDate(chart.current[i].date)}
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-muted">Previous period aligned by day number.</p>
    </section>
  );
}

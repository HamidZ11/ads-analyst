"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatDate, formatMetric } from "@/domain/format";
import { METRIC_DEFINITIONS } from "@/domain/metrics";
import type { CurrencyCode, MetricKey } from "@/domain/types";
import { cn } from "@/lib/cn";
import {
  CHART_HEIGHT,
  CHART_WIDTH,
  chartLabelIndexes,
  chartSeriesGeometry,
  type ChartSeries,
} from "./chart-geometry";

interface PerformanceChartProps {
  series: Partial<Record<MetricKey, ChartSeries>>;
  metricKeys: MetricKey[];
  selectedKey: MetricKey;
  currency: CurrencyCode;
  targets: Partial<Record<MetricKey, number | null>>;
  totals: Partial<Record<MetricKey, number | null>>;
  labels: Partial<Record<MetricKey, string>>;
  comparison: string;
  singleDay: boolean;
}

export function PerformanceChart({
  series,
  metricKeys,
  selectedKey,
  currency,
  targets,
  totals,
  labels,
  comparison,
  singleDay,
}: PerformanceChartProps) {
  const [activeKey, setActiveKey] = useState(selectedKey);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const chart = series[activeKey] ?? { current: [], previous: [] };
  const target = targets[activeKey] ?? null;
  // One-day totals cannot form a line. Earlier dates are grey; the segment
  // into the selected day is blue. Never manufacture intraday readings.
  const { axis, coordinates, current, previous } = chartSeriesGeometry(
    chart,
    target,
    singleDay,
    METRIC_DEFINITIONS[activeKey].format === "count" ? 1 : 0,
  );
  const end = coordinates.at(-1);
  const endPoint = chart.current.at(-1);
  const selectedIndex = Math.max(
    0,
    Math.min(hoverIndex ?? chart.current.length - 1, chart.current.length - 1),
  );
  const inspected = chart.current[selectedIndex];
  const prior = singleDay ? chart.current[selectedIndex - 1] : chart.previous[selectedIndex];
  const inspectedCoordinate = coordinates[selectedIndex];
  const labelIndexes = chartLabelIndexes(chart.current.length);
  const label = labels[activeKey] ?? METRIC_DEFINITIONS[activeKey].label;
  const display = (value: number | null, key = activeKey) =>
    formatMetric(key, value, currency, { compact: key === "spend" || key === "revenue" });
  const yPercent = (y: number) => `${(y / CHART_HEIGHT) * 100}%`;

  function inspectPointer(event: PointerEvent<HTMLDivElement>) {
    const box = plotRef.current?.getBoundingClientRect();
    if (!box || !chart.current.length) return;
    const fraction = Math.max(0, Math.min(1, (event.clientX - box.left) / box.width));
    setHoverIndex(Math.round(fraction * (chart.current.length - 1)));
  }

  function inspectKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") setHoverIndex(null);
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? chart.current.length - 1
          : selectedIndex + (event.key === "ArrowLeft" ? -1 : 1);
    setHoverIndex(Math.max(0, Math.min(chart.current.length - 1, index)));
  }

  return (
    <section aria-labelledby="performance-chart-title" className="min-w-0">
      <div className="overflow-x-auto border-b border-border">
        <div role="group" aria-label="Chart metric" className="flex min-w-max gap-6 sm:gap-7">
          {metricKeys.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === activeKey}
              onClick={() => {
                setActiveKey(key);
                setHoverIndex(null);
              }}
              className={cn(
                "border-b-2 px-0.5 pt-1 pb-3 text-left transition-colors hover:bg-surface-subtle",
                key === activeKey
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-muted",
              )}
            >
              <span className="block text-xs font-medium">
                {labels[key] ?? METRIC_DEFINITIONS[key].shortLabel}
              </span>
              <span className="mt-1 block text-lg font-semibold tracking-[-0.01em] tabular">
                {display(totals[key] ?? null, key)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 id="performance-chart-title" className="text-xs font-medium text-ink-secondary">
          Daily {label.toLowerCase()}
        </h2>
        <ul
          aria-label="Chart legend"
          className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-ink-muted"
        >
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 bg-chart-primary" />
            {singleDay ? "Selected day" : "This period"}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-0.5 w-4 bg-chart-muted" />
            {singleDay ? "Earlier days" : "Previous period"}
          </li>
          {target !== null && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="w-4 border-t border-dashed border-ink-muted" />
              Target {display(target)}
            </li>
          )}
        </ul>
      </div>
      <div className="mt-7 mr-12 ml-12 sm:mr-14">
        <div
          ref={plotRef}
          data-chart-plot
          tabIndex={0}
          role="group"
          aria-label={`${label} chart. Use left and right arrows to inspect days; Escape to dismiss.`}
          aria-describedby="chart-context"
          onPointerMove={inspectPointer}
          onPointerDown={inspectPointer}
          onPointerLeave={() => setHoverIndex(null)}
          onKeyDown={inspectKey}
          onFocus={() => setHoverIndex(chart.current.length - 1)}
          onBlur={() => setHoverIndex(null)}
          className="relative h-[280px] sm:h-[320px]"
        >
          {axis.ticks.map((tick) => (
            <div
              key={tick}
              aria-hidden
              className="absolute inset-x-0"
              style={{ top: `${100 - (tick / axis.max) * 100}%` }}
            >
              <span className="absolute right-full mr-3 -translate-y-1/2 text-xs text-ink-muted tabular">
                {formatMetric(activeKey, tick, currency, {
                  compact: true,
                  ...(METRIC_DEFINITIONS[activeKey].format === "currency"
                    ? { decimals: Number.isInteger(tick) ? 0 : 2 }
                    : {}),
                })}
              </span>
              <div className={cn("h-px", tick === 0 ? "bg-border-strong" : "bg-chart-grid")} />
            </div>
          ))}
          {singleDay && chart.current.length > 1 && (
            <div
              aria-hidden
              className="absolute inset-y-0 right-0 bg-accent-soft/50"
              style={{ width: `${50 / (chart.current.length - 1)}%` }}
            />
          )}
          {target !== null && (
            <div
              data-chart-target
              aria-hidden
              className="absolute inset-x-0 border-t border-dashed border-ink-muted"
              style={{ top: `${100 - (target / axis.max) * 100}%` }}
            />
          )}
          <svg
            aria-hidden
            className="absolute inset-0 h-full w-full overflow-visible"
            viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
            preserveAspectRatio="none"
          >
            <path d={current.area} fill="var(--color-chart-primary)" fillOpacity="0.04" />
            <path
              data-series="previous"
              d={previous.line}
              fill="none"
              stroke="var(--color-chart-muted)"
              strokeWidth="1.75"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <path
              data-series="current"
              d={current.line}
              fill="none"
              stroke="var(--color-chart-primary)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
          {previous.isolated.map((p) => (
            <span
              key={p.x}
              aria-hidden
              className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-muted"
              style={{ left: `${p.x / 10}%`, top: yPercent(p.y) }}
            />
          ))}
          {current.isolated.map((p) => (
            <span
              key={p.x}
              aria-hidden
              className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-primary"
              style={{ left: `${p.x / 10}%`, top: yPercent(p.y) }}
            />
          ))}
          {end?.y !== null && end?.y !== undefined && endPoint ? (
            <>
              <span
                aria-hidden
                className="absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-primary ring-2 ring-surface"
                style={{ left: `${end.x / 10}%`, top: yPercent(end.y) }}
              />
              <span
                data-chart-end
                className="absolute left-full ml-2 -translate-y-1/2 text-xs font-semibold whitespace-nowrap text-ink tabular"
                style={{ top: yPercent(end.y) }}
              >
                {display(endPoint.value)}
              </span>
            </>
          ) : null}
          {!coordinates.some((p) => p.y !== null) && (
            <p className="absolute inset-0 flex items-center justify-center text-sm text-ink-muted">
              No daily readings for this metric.
            </p>
          )}
          {hoverIndex !== null && inspected && inspectedCoordinate && (
            <>
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 border-l border-dashed border-ink-faint"
                style={{ left: `${inspectedCoordinate.x / 10}%` }}
              />
              {inspectedCoordinate.y !== null && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-chart-primary ring-2 ring-surface"
                  style={{
                    left: `${inspectedCoordinate.x / 10}%`,
                    top: yPercent(inspectedCoordinate.y),
                  }}
                />
              )}
              <div
                role="status"
                data-chart-tooltip
                className="pointer-events-none absolute top-3 z-10 w-[184px] rounded-md border border-border bg-surface p-3 text-xs shadow-md"
                style={{
                  left: `clamp(0px, calc(${inspectedCoordinate.x / 10}% - 92px), calc(100% - 184px))`,
                }}
              >
                <p className="font-medium text-ink">{label}</p>
                <p className="mt-2 flex items-baseline justify-between gap-3 text-ink-muted">
                  <span>{formatDate(inspected.date)}</span>
                  <span className="font-semibold text-ink tabular">
                    {display(inspected.value)}
                  </span>
                </p>
                {prior && (
                  <p className="mt-1 flex items-baseline justify-between gap-3 text-ink-muted">
                    <span>{formatDate(prior.date)}</span>
                    <span className="tabular">{display(prior.value)}</span>
                  </p>
                )}
                {target !== null && (
                  <p className="mt-2 flex justify-between gap-3 border-t border-border pt-2 text-ink-muted">
                    <span>Target</span>
                    <span className="tabular">{display(target)}</span>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        <div aria-hidden className="relative mt-3 h-4 text-xs text-ink-muted tabular">
          {labelIndexes.map((i) => (
            <span
              key={i}
              className="absolute whitespace-nowrap"
              style={{
                left: `${coordinates[i].x / 10}%`,
                transform: `translateX(${i === 0 ? "0" : i === chart.current.length - 1 ? "-100%" : "-50%"})`,
              }}
            >
              {formatDate(chart.current[i].date)}
            </span>
          ))}
        </div>
      </div>
      <p id="chart-context" className="mt-4 text-xs leading-5 text-ink-muted">
        {singleDay
          ? `14-day context · ${endPoint ? formatDate(endPoint.date) : "Selected day"} highlighted. Grey shows earlier days.`
          : `Compared with ${comparison}, aligned by day number.`}
      </p>
    </section>
  );
}

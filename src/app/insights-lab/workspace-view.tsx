"use client";

import { useMemo, useState } from "react";
import { Delta } from "@/components/ui/delta";
import { formatCurrency, formatDate, formatNumber, formatPercent } from "@/domain/format";
import type { CurrencyCode } from "@/domain/types";
import {
  CHART_HEIGHT,
  chartLabelIndexes,
  chartSeriesGeometry,
} from "@/features/overview/chart-geometry";
import { cn } from "@/lib/cn";
import type { InsightFixture, Priority } from "./fixtures";
import { EntityLine, EvidenceMetric, MATERIALITY, PriorityLabel, PriorityTabs } from "./shared";

const ORDER: Priority[] = ["high", "opportunity", "watch"];

function formatBy(format: "count" | "percent" | "currency", currency: CurrencyCode) {
  return (v: number) =>
    format === "currency"
      ? formatCurrency(v, currency, { compact: true, decimals: Number.isInteger(v) ? 0 : 2 })
      : format === "percent"
        ? formatPercent(v, 1)
        : formatNumber(v);
}

/** Master list of findings and a factual detail pane; filter and selection are real. */
export function WorkspaceView({
  fixtures,
  counts,
  currency,
  comparison,
  currentLabel,
  previousLabel,
}: {
  fixtures: InsightFixture[];
  counts: { high: number; opportunity: number; watch: number };
  currency: CurrencyCode;
  comparison: string;
  currentLabel: string;
  previousLabel: string;
}) {
  const [filter, setFilter] = useState<"all" | Priority>("all");
  const [selectedId, setSelectedId] = useState(fixtures[0]?.id);
  const list = useMemo(
    () =>
      [...fixtures]
        .filter((f) => filter === "all" || f.priority === filter)
        .sort((a, b) => ORDER.indexOf(a.priority) - ORDER.indexOf(b.priority)),
    [fixtures, filter],
  );
  const selected = list.find((f) => f.id === selectedId) ?? list[0];
  const chartData = selected?.chart;
  const chart =
    chartData && chartData.current.length > 1
      ? chartSeriesGeometry(
          {
            current: chartData.dates.map((date, i) => ({ date, value: chartData.current[i] })),
            previous: chartData.dates.map((date, i) => ({
              date,
              value: chartData.previous[i] ?? null,
            })),
          },
          null,
          false,
        )
      : null;
  const fmt = chartData ? formatBy(chartData.format, currency) : (v: number) => String(v);

  return (
    <div className="grid grid-cols-[400px_minmax(0,1fr)] gap-10">
      <div className="min-w-0">
        <div className="border-b border-border">
          <PriorityTabs counts={counts} selected={filter} onSelect={(v) => setFilter(v)} />
        </div>
        {list.length === 0 ? (
          <div className="py-10">
            <p className="text-sm font-medium text-ink">
              No findings in this group for the selected period
            </p>
            <p className="mt-1 text-xs text-ink-muted">Other groups may still hold findings.</p>
          </div>
        ) : (
          <ol className="divide-y divide-border">
            {list.map((f) => {
              const isSelected = selected?.id === f.id;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(f.id)}
                    className={cn(
                      "relative flex w-full items-start gap-4 px-3 py-3.5 text-left transition-colors",
                      isSelected
                        ? "bg-surface-subtle before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r before:bg-accent"
                        : "hover:bg-surface-hover",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <PriorityLabel priority={f.priority} />
                      <span className="mt-1 block text-sm leading-5 font-medium text-ink">
                        {f.headline}
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-muted">
                        {f.entity.kind} · {f.entity.name}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-semibold text-ink tabular">
                        {f.key.value}
                      </span>
                      <span className="block text-xs text-ink-muted">{f.key.label}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {selected ? (
        <section aria-live="polite" className="min-w-0 border-l border-border pl-10">
          <div className="flex items-center gap-3">
            <PriorityLabel priority={selected.priority} />
            <span className="text-xs text-ink-faint">{selected.detector}</span>
          </div>
          <h2 className="mt-2 text-[18px] leading-6 font-semibold tracking-[-0.02em] text-ink">
            {selected.headline}
          </h2>
          <EntityLine entity={selected.entity} className="mt-1.5" />

          <div className="mt-6 grid grid-cols-4 gap-x-6 border-t border-border pt-4">
            {selected.evidence.slice(0, 4).map((e) => (
              <EvidenceMetric key={e.label} item={e} size="lg" />
            ))}
          </div>

          {chart && chartData ? (
            <section className="mt-6 border-t border-border pt-4" aria-label={chartData.title}>
              <div className="flex items-baseline justify-between">
                <h3 className="text-xs font-medium text-ink-secondary">{chartData.title}</h3>
                <ul className="flex gap-4 text-xs text-ink-muted">
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden className="h-0.5 w-3 bg-chart-primary" />
                    {currentLabel}
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span aria-hidden className="h-0.5 w-3 bg-chart-muted" />
                    {previousLabel} · by day
                  </li>
                </ul>
              </div>
              <div className="relative mt-4 mr-12 ml-12 h-[140px]">
                {chart.axis.ticks.map((tick) => (
                  <div
                    key={tick}
                    aria-hidden
                    className="absolute inset-x-0"
                    style={{ top: `${100 - (tick / chart.axis.max) * 100}%` }}
                  >
                    <span className="absolute right-full mr-3 -translate-y-1/2 text-xs text-ink-muted tabular">
                      {fmt(tick)}
                    </span>
                    <div
                      className={cn("h-px", tick === 0 ? "bg-border-strong" : "bg-chart-grid")}
                    />
                  </div>
                ))}
                <svg
                  aria-hidden
                  className="absolute inset-0 h-full w-full overflow-visible"
                  viewBox={`0 0 1000 ${CHART_HEIGHT}`}
                  preserveAspectRatio="none"
                >
                  <path
                    d={chart.current.area}
                    fill="var(--color-chart-primary)"
                    fillOpacity="0.04"
                  />
                  <path
                    d={chart.previous.line}
                    fill="none"
                    stroke="var(--color-chart-muted)"
                    strokeWidth="1.75"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                  <path
                    d={chart.current.line}
                    fill="none"
                    stroke="var(--color-chart-primary)"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
              <div
                aria-hidden
                className="relative mt-2 mr-12 ml-12 h-4 text-xs text-ink-muted tabular"
              >
                {chartLabelIndexes(chartData.dates.length).map((i) => (
                  <span
                    key={i}
                    className="absolute whitespace-nowrap"
                    style={{
                      left: `${(chart.coordinates[i].x / 1000) * 100}%`,
                      transform: `translateX(${i === 0 ? "0" : i === chartData.dates.length - 1 ? "-100%" : "-50%"})`,
                    }}
                  >
                    {formatDate(chartData.dates[i])}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {selected.shares ? (
            <section
              className="mt-6 border-t border-border pt-4"
              aria-label="Share of spend by campaign"
            >
              <h3 className="text-xs font-medium text-ink-secondary">
                Share of spend by campaign
              </h3>
              <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-sm">
                {selected.shares.map((s, i) => (
                  <span
                    key={s.name}
                    className={i < 3 ? "bg-accent" : "bg-surface-active"}
                    style={{ width: `${s.share * 100}%` }}
                  />
                ))}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                {selected.shares.map((s, i) => (
                  <li key={s.name} className="flex items-center justify-between gap-3">
                    <span className={cn("truncate", i < 3 ? "text-ink" : "text-ink-muted")}>
                      {s.name}
                    </span>
                    <span className="shrink-0 font-medium text-ink tabular">
                      {formatPercent(s.share, 0)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {selected.comparison ? (
            <section className="mt-6 border-t border-border pt-4" aria-label="Comparison">
              <h3 className="text-xs font-medium text-ink-secondary">
                {selected.detector === "Underfunded winner"
                  ? "Ads in this campaign"
                  : `Compared with ${comparison}`}
              </h3>
              <table className="mt-1 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-ink-muted">
                    <th scope="col" className="h-8 text-left font-medium">
                      {selected.detector === "Underfunded winner" ? "Ad" : "Metric"}
                    </th>
                    <th scope="col" className="h-8 text-right font-medium">
                      {selected.detector === "Underfunded winner" ? "Spend" : "Now"}
                    </th>
                    <th scope="col" className="h-8 text-right font-medium">
                      {selected.detector === "Underfunded winner"
                        ? "Cost per purchase"
                        : "Before"}
                    </th>
                    {selected.detector === "Underfunded winner" ? null : (
                      <th scope="col" className="h-8 text-right font-medium">
                        Change
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selected.comparison.map((row) => (
                    <tr key={row.label} className="border-b border-border last:border-b-0">
                      <td className="h-9 max-w-[260px] truncate pr-3 text-ink-secondary">
                        {row.label}
                      </td>
                      <td className="h-9 text-right font-medium text-ink tabular">{row.now}</td>
                      <td className="h-9 text-right text-ink-muted tabular">{row.before}</td>
                      {selected.detector === "Underfunded winner" ? null : (
                        <td className="h-9 text-right">
                          <Delta
                            change={row.change}
                            higherIsBetter={row.higherIsBetter}
                            neutralBelow={MATERIALITY}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <section className="mt-6 border-t border-border pt-4" aria-label="Suggested action">
            <h3 className="text-xs font-medium text-ink-secondary">Suggested action</h3>
            <p className="mt-1 text-sm text-ink">{selected.action}</p>
          </section>

          <section
            className="mt-5 rounded-md bg-surface-subtle px-4 py-3"
            aria-label="Why this was flagged"
          >
            <h3 className="text-xs font-medium text-ink-secondary">Why this was flagged</h3>
            <p className="mt-1 text-xs leading-5 text-ink-muted">{selected.whyFlagged}</p>
            <p className="mt-1 text-xs text-ink-faint">
              Detector: {selected.detector} · computed from daily metrics for the selected
              period.
            </p>
          </section>
        </section>
      ) : null}
    </div>
  );
}

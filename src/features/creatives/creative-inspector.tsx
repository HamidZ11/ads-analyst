"use client";

import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { RefObject } from "react";
import { Delta } from "@/components/ui/delta";
import { formatCurrency, formatDate, formatMetric, formatNumber } from "@/domain/format";
import { CREATIVE_TYPE_LABELS } from "@/domain/labels";
import {
  CHART_HEIGHT,
  chartLabelIndexes,
  chartSeriesGeometry,
} from "@/features/overview/chart-geometry";
import { cn } from "@/lib/cn";
import type { CreativeBoardItem, CreativeBoardModel } from "./board-data";
import { CreativeArtwork } from "./creative-artwork";

export const CREATIVE_MATERIALITY = 0.05;

function TargetLine({
  cpa,
  target,
  currency,
}: {
  cpa: number | null;
  target: number | null;
  currency: CreativeBoardModel["currency"];
}) {
  if (target === null || target <= 0 || cpa === null) return null;
  const diff = cpa - target;
  if (Math.abs(diff) < 0.005)
    return <p className="text-xs font-medium text-ink-muted">On target</p>;
  return (
    <p className={cn("text-xs font-medium", diff > 0 ? "text-negative" : "text-positive")}>
      {formatCurrency(Math.abs(diff), currency, { decimals: 2 })} {diff > 0 ? "over" : "under"}{" "}
      target
    </p>
  );
}

/**
 * Non-modal right-side inspector for one creative: rank and context, larger
 * artwork, primary metrics with change and target context, a compact daily
 * spend chart against the previous period, where the creative runs, and a
 * now / before / change table. Factual only. Escape closes; focus returns.
 */
export function CreativeInspector({
  item,
  rank,
  rankLabel,
  model,
  returnFocusTo,
  onClose,
}: {
  item: CreativeBoardItem | null;
  rank: number;
  rankLabel: string;
  model: CreativeBoardModel;
  /** The entry button to focus when the inspector closes. */
  returnFocusTo?: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const {
    currency,
    vocabulary,
    showRoas,
    targetCpa,
    comparison,
    currentLabel,
    previousLabel,
    singleDay,
  } = model;
  const secondary = showRoas ? "roas" : "cpc";
  const chart =
    item && !singleDay
      ? chartSeriesGeometry(
          { current: item.spendCurrent, previous: item.spendPrevious },
          null,
          false,
        )
      : null;
  const end = chart?.coordinates.at(-1);
  const labelIndexes = item ? chartLabelIndexes(item.spendCurrent.length) : [];

  return (
    <Dialog.Root
      open={item !== null}
      onOpenChange={(open) => (open ? null : onClose())}
      modal={false}
    >
      <Dialog.Portal>
        <Dialog.Content
          onInteractOutside={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            // A mouse click does not focus the entry on every platform, so
            // Radix may have nothing to restore to; return focus explicitly.
            const target = returnFocusTo?.current;
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          aria-label={item ? `Creative inspector: ${item.name}` : "Creative inspector"}
          className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-surface shadow-md focus:outline-none data-[state=closed]:animate-fade-out data-[state=open]:animate-rise-in motion-reduce:animate-none sm:w-[440px]"
        >
          {item ? (
            <>
              <div className="flex items-start justify-between gap-3 border-b border-border px-5 pt-4 pb-4">
                <div className="min-w-0">
                  <Dialog.Description className="text-xs text-ink-muted tabular">
                    #{rank} by {rankLabel} · {CREATIVE_TYPE_LABELS[item.type]} · {item.adCount}{" "}
                    {item.adCount === 1 ? "ad" : "ads"} · {item.campaignCount}{" "}
                    {item.campaignCount === 1 ? "campaign" : "campaigns"}
                  </Dialog.Description>
                  <Dialog.Title className="mt-1 text-[16px] leading-6 font-semibold tracking-[-0.02em] text-ink">
                    {item.name}
                  </Dialog.Title>
                </div>
                <Dialog.Close
                  aria-label="Close inspector"
                  className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-hover hover:text-ink"
                >
                  <X aria-hidden size={16} />
                </Dialog.Close>
              </div>

              <div className="flex-1 scrollbar-thin overflow-y-auto px-5 pb-6">
                <div className="flex gap-4 pt-5">
                  <CreativeArtwork
                    thumbnail={item.thumbnail}
                    type={item.type}
                    width={120}
                    height={150}
                  />
                  <div className="min-w-0 flex-1">
                    {item.headline ? (
                      <p className="text-sm leading-5 text-ink-secondary">“{item.headline}”</p>
                    ) : null}
                    <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
                      <div className="min-w-0">
                        <dt className="text-xs text-ink-muted">Spend</dt>
                        <dd className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink tabular">
                          {formatCurrency(item.current.spend, currency)}
                        </dd>
                        <dd className="text-xs">
                          <Delta
                            change={item.change.spend}
                            higherIsBetter={null}
                            neutralBelow={CREATIVE_MATERIALITY}
                          />
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-ink-muted">{vocabulary.plural}</dt>
                        <dd className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink tabular">
                          {formatNumber(item.current.conversions)}
                        </dd>
                        <dd className="text-xs">
                          <Delta
                            change={item.change.conversions}
                            higherIsBetter={true}
                            neutralBelow={CREATIVE_MATERIALITY}
                          />
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-3 gap-x-4 border-t border-border pt-4">
                  <div className="min-w-0">
                    <dt className="truncate text-xs text-ink-muted">{vocabulary.costLabel}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink tabular">
                      {formatMetric("cpa", item.current.cpa, currency)}
                    </dd>
                    <dd>
                      <TargetLine
                        cpa={item.current.cpa}
                        target={targetCpa}
                        currency={currency}
                      />
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-muted">{showRoas ? "ROAS" : "CPC"}</dt>
                    <dd className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink tabular">
                      {formatMetric(secondary, item.current[secondary], currency)}
                    </dd>
                    {showRoas ? (
                      <dd className="text-xs">
                        <Delta
                          change={item.change.roas}
                          higherIsBetter={true}
                          neutralBelow={CREATIVE_MATERIALITY}
                        />
                      </dd>
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-muted">CTR</dt>
                    <dd className="mt-0.5 text-lg font-semibold tracking-[-0.01em] text-ink tabular">
                      {formatMetric("ctr", item.current.ctr, currency)}
                    </dd>
                    <dd className="text-xs">
                      <Delta
                        change={item.change.ctr}
                        higherIsBetter={true}
                        neutralBelow={CREATIVE_MATERIALITY}
                      />
                    </dd>
                  </div>
                </dl>

                <section className="mt-6 border-t border-border pt-4" aria-label="Daily spend">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 className="text-xs font-medium text-ink-secondary">Daily spend</h3>
                    {chart ? (
                      <ul className="flex gap-3 text-xs text-ink-muted">
                        <li className="flex items-center gap-1.5">
                          <span aria-hidden className="h-0.5 w-3 bg-chart-primary" />
                          {currentLabel}
                        </li>
                        <li className="flex items-center gap-1.5">
                          <span aria-hidden className="h-0.5 w-3 bg-chart-muted" />
                          {previousLabel}
                        </li>
                      </ul>
                    ) : null}
                  </div>
                  {chart ? (
                    <>
                      <div className="relative mt-4 mr-10 ml-10 h-[120px]">
                        {chart.axis.ticks.map((tick) => (
                          <div
                            key={tick}
                            aria-hidden
                            className="absolute inset-x-0"
                            style={{ top: `${100 - (tick / chart.axis.max) * 100}%` }}
                          >
                            <span className="absolute right-full mr-2 -translate-y-1/2 text-2xs text-ink-muted tabular">
                              {formatCurrency(tick, currency, {
                                compact: true,
                                decimals: Number.isInteger(tick) ? 0 : 2,
                              })}
                            </span>
                            <div
                              className={cn(
                                "h-px",
                                tick === 0 ? "bg-border-strong" : "bg-chart-grid",
                              )}
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
                        {end && end.y !== null ? (
                          <span
                            className="absolute left-full ml-2 -translate-y-1/2 text-xs font-semibold whitespace-nowrap text-ink tabular"
                            style={{ top: `${(end.y / CHART_HEIGHT) * 100}%` }}
                          >
                            {formatCurrency(item.spendCurrent.at(-1)?.value ?? 0, currency)}
                          </span>
                        ) : null}
                      </div>
                      <div
                        aria-hidden
                        className="relative mt-2 mr-10 ml-10 h-4 text-2xs text-ink-muted tabular"
                      >
                        {labelIndexes.map((i) => (
                          <span
                            key={i}
                            className="absolute whitespace-nowrap"
                            style={{
                              left: `${(chart.coordinates[i].x / 1000) * 100}%`,
                              transform: `translateX(${i === 0 ? "0" : i === item.spendCurrent.length - 1 ? "-100%" : "-50%"})`,
                            }}
                          >
                            {formatDate(item.spendCurrent[i].date)}
                          </span>
                        ))}
                      </div>
                      <p className="mt-2 text-xs text-ink-muted">
                        Previous period aligned by day number.
                      </p>
                    </>
                  ) : (
                    <p className="mt-2 text-xs text-ink-muted">
                      A one-day period has no daily trend. Choose 7, 14 or 30 days to compare
                      days.
                    </p>
                  )}
                </section>

                <section className="mt-6 border-t border-border pt-4" aria-label="Used in">
                  <h3 className="text-xs font-medium text-ink-secondary">Used in</h3>
                  <ul className="mt-1 divide-y divide-border">
                    {item.usage.map((u, index) => (
                      <li
                        key={`${u.campaign}-${u.ad}-${index}`}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm text-ink" title={u.campaign}>
                            {u.campaign}
                          </span>
                          <span className="block truncate text-xs text-ink-muted" title={u.ad}>
                            {u.ad}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium text-ink tabular">
                          {formatCurrency(u.spend, currency)}
                        </span>
                      </li>
                    ))}
                    {item.usage.length === 0 ? (
                      <li className="py-2.5 text-xs text-ink-muted">Not used by any ad.</li>
                    ) : null}
                  </ul>
                </section>

                <section
                  className="mt-6 border-t border-border pt-4"
                  aria-label={`Compared with ${comparison}`}
                >
                  <h3 className="text-xs font-medium text-ink-secondary">
                    Compared with {comparison}
                  </h3>
                  <table className="mt-1 w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs text-ink-muted">
                        <th scope="col" className="h-8 text-left font-medium">
                          Metric
                        </th>
                        <th scope="col" className="h-8 text-right font-medium">
                          Now
                        </th>
                        <th scope="col" className="h-8 text-right font-medium">
                          Before
                        </th>
                        <th scope="col" className="h-8 text-right font-medium">
                          Change
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          label: "Spend",
                          now: formatCurrency(item.current.spend, currency),
                          before: formatCurrency(item.previous.spend, currency),
                          change: item.change.spend,
                          hib: null as boolean | null,
                        },
                        {
                          label: vocabulary.plural,
                          now: formatNumber(item.current.conversions),
                          before: formatNumber(item.previous.conversions),
                          change: item.change.conversions,
                          hib: true as boolean | null,
                        },
                        {
                          label: vocabulary.costLabel,
                          now: formatMetric("cpa", item.current.cpa, currency),
                          before: formatMetric("cpa", item.previous.cpa, currency),
                          change: item.change.cpa,
                          hib: false as boolean | null,
                        },
                        ...(showRoas
                          ? [
                              {
                                label: "ROAS",
                                now: formatMetric("roas", item.current.roas, currency),
                                before: formatMetric("roas", item.previous.roas, currency),
                                change: item.change.roas,
                                hib: true as boolean | null,
                              },
                            ]
                          : []),
                        {
                          label: "CTR",
                          now: formatMetric("ctr", item.current.ctr, currency),
                          before: formatMetric("ctr", item.previous.ctr, currency),
                          change: item.change.ctr,
                          hib: true as boolean | null,
                        },
                      ].map((row) => (
                        <tr key={row.label} className="border-b border-border last:border-b-0">
                          <td className="h-9 text-ink-secondary">{row.label}</td>
                          <td className="h-9 text-right font-medium text-ink tabular">
                            {row.now}
                          </td>
                          <td className="h-9 text-right text-ink-muted tabular">
                            {row.before}
                          </td>
                          <td className="h-9 text-right">
                            <Delta
                              change={row.change}
                              higherIsBetter={row.hib}
                              neutralBelow={CREATIVE_MATERIALITY}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              </div>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Delta } from "@/components/ui/delta";
import { formatCurrency, formatMetric, formatNumber } from "@/domain/format";
import { CREATIVE_TYPE_LABELS, type ConversionVocabulary } from "@/domain/labels";
import { percentChange } from "@/domain/metrics";
import type { CreativeType, CurrencyCode } from "@/domain/types";
import { cn } from "@/lib/cn";
import { buildChart } from "../design-lab/chart-geo";
import type { SplitCreative } from "./data";
import { Artwork, MATERIALITY, TargetLine } from "./shared";

type SortKey = "spend" | "roas" | "cpa" | "ctr" | "conversions";
type TypeFilter = "all" | CreativeType;

/** "ROAS" and "CTR" keep their case in prose; other labels read lowercase. */
function rankWord(label: string): string {
  const base = label.replace(" (lowest first)", "");
  return base === base.toUpperCase() ? base : base.toLowerCase();
}

const W = 640;
const H = 150;

function sortValue(c: SplitCreative, key: SortKey): number | null {
  switch (key) {
    case "spend":
      return c.spend;
    case "roas":
      return c.roas;
    case "cpa":
      return c.cpa;
    case "ctr":
      return c.ctr;
    case "conversions":
      return c.conversions;
  }
}

/** Master list and detail pane; selection, sort and type filter are real. */
export function SplitView({
  creatives,
  currency,
  vocabulary,
  targetCpa,
  showRoas,
  comparison,
  previousLabel,
  currentLabel,
}: {
  creatives: SplitCreative[];
  currency: CurrencyCode;
  vocabulary: ConversionVocabulary;
  targetCpa: number;
  showRoas: boolean;
  comparison: string;
  previousLabel: string;
  currentLabel: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [type, setType] = useState<TypeFilter>("all");
  const [selectedId, setSelectedId] = useState(creatives[0]?.id);

  const list = useMemo(() => {
    const asc = sortKey === "cpa";
    return creatives
      .filter((c) => type === "all" || c.type === type)
      .sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return asc ? av - bv : bv - av;
      });
  }, [creatives, sortKey, type]);

  const selected = list.find((c) => c.id === selectedId) ?? list[0];
  const rank = selected ? list.indexOf(selected) + 1 : 0;
  const counts = {
    all: creatives.length,
    image: creatives.filter((c) => c.type === "image").length,
    video: creatives.filter((c) => c.type === "video").length,
    carousel: creatives.filter((c) => c.type === "carousel").length,
  };
  const sortLabel: Record<SortKey, string> = {
    spend: "Spend",
    roas: "ROAS",
    cpa: `${vocabulary.costLabel} (lowest first)`,
    ctr: "CTR",
    conversions: vocabulary.plural,
  };

  const chart = selected
    ? buildChart(
        {
          cur: selected.spendSeries.slice(selected.split),
          pre: selected.spendSeries.slice(0, selected.split),
          target: null,
        },
        W,
        H,
      )
    : null;

  const comparisons = selected
    ? [
        {
          label: "Spend",
          current: formatCurrency(selected.spend, currency),
          previous: formatCurrency(selected.previousSpend, currency),
          change: percentChange(selected.spend, selected.previousSpend),
          higherIsBetter: null as boolean | null,
        },
        {
          label: vocabulary.plural,
          current: formatNumber(selected.conversions),
          previous: formatNumber(selected.previousConversions),
          change: percentChange(selected.conversions, selected.previousConversions),
          higherIsBetter: true as boolean | null,
        },
        {
          label: vocabulary.costLabel,
          current: formatMetric("cpa", selected.cpa, currency),
          previous: formatMetric("cpa", selected.previousCpa, currency),
          change: percentChange(selected.cpa, selected.previousCpa),
          higherIsBetter: false as boolean | null,
        },
        {
          label: showRoas ? "ROAS" : "CTR",
          current: formatMetric(
            showRoas ? "roas" : "ctr",
            showRoas ? selected.roas : selected.ctr,
            currency,
          ),
          previous: formatMetric(
            showRoas ? "roas" : "ctr",
            showRoas ? selected.previousRoas : selected.previousCtr,
            currency,
          ),
          change: percentChange(
            showRoas ? selected.roas : selected.ctr,
            showRoas ? selected.previousRoas : selected.previousCtr,
          ),
          higherIsBetter: true as boolean | null,
        },
      ]
    : [];

  return (
    <div className="grid grid-cols-[400px_minmax(0,1fr)] gap-10">
      <div className="min-w-0">
        <div className="flex items-end justify-between gap-3 border-b border-border">
          <div role="group" aria-label="Filter by type" className="flex gap-4">
            {(
              [
                ["all", "All"],
                ["image", "Image"],
                ["video", "Video"],
                ["carousel", "Carousel"],
              ] as Array<[TypeFilter, string]>
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(value)}
                className={cn(
                  "-mb-px flex h-9 items-center gap-1.5 border-b-2 text-sm font-medium transition-colors",
                  type === value
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {label}
                <span className="text-xs text-ink-faint tabular">{counts[value]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 py-2.5">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Rank by
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-7 rounded-md border border-border bg-surface px-2 text-xs text-ink transition-colors hover:border-border-strong"
            >
              {(Object.keys(sortLabel) as SortKey[])
                .filter((k) => showRoas || k !== "roas")
                .map((k) => (
                  <option key={k} value={k}>
                    {sortLabel[k]}
                  </option>
                ))}
            </select>
          </label>
          <p className="text-xs text-ink-muted tabular">{list.length} creatives</p>
        </div>
        <ol className="divide-y divide-border">
          {list.map((c, index) => {
            const isSelected = selected?.id === c.id;
            const delivering = c.spend > 0;
            return (
              <li key={c.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(c.id)}
                  className={cn(
                    "relative flex h-16 w-full items-center gap-3 pr-3 pl-3 text-left transition-colors",
                    isSelected
                      ? "bg-surface-subtle before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-r before:bg-accent"
                      : "hover:bg-surface-hover",
                  )}
                >
                  <span className="w-5 shrink-0 text-xs text-ink-faint tabular">
                    {index + 1}
                  </span>
                  <Artwork thumbnail={c.thumbnail} type={c.type} width={40} height={50} />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm font-medium",
                        delivering ? "text-ink" : "text-ink-muted",
                      )}
                    >
                      {c.name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-muted">
                      {CREATIVE_TYPE_LABELS[c.type]} · {c.adCount}{" "}
                      {c.adCount === 1 ? "ad" : "ads"}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular">
                    <span className="block text-sm font-semibold text-ink">
                      {delivering ? formatCurrency(c.spend, currency) : "—"}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {delivering
                        ? showRoas
                          ? `${formatMetric("roas", c.roas, currency)} ROAS`
                          : formatMetric("cpa", c.cpa, currency)
                        : "no delivery"}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {selected && chart ? (
        <section aria-live="polite" className="min-w-0 border-l border-border pl-10">
          <div className="flex gap-6">
            <Artwork
              thumbnail={selected.thumbnail}
              type={selected.type}
              width={168}
              height={210}
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-ink-muted tabular">
                #{rank} by {rankWord(sortLabel[sortKey])} ·{" "}
                {CREATIVE_TYPE_LABELS[selected.type]} · {selected.adCount}{" "}
                {selected.adCount === 1 ? "ad" : "ads"} · {selected.campaignCount}{" "}
                {selected.campaignCount === 1 ? "campaign" : "campaigns"}
              </p>
              <h2 className="mt-1.5 text-[18px] leading-6 font-semibold tracking-[-0.02em] text-ink">
                {selected.name}
              </h2>
              <p className="mt-1 text-sm text-ink-muted">“{selected.headline}”</p>
              <dl className="mt-5 grid grid-cols-5 gap-x-6">
                {[
                  {
                    label: "Spend",
                    value: formatCurrency(selected.spend, currency),
                    sub: (
                      <Delta
                        change={percentChange(selected.spend, selected.previousSpend)}
                        higherIsBetter={null}
                        neutralBelow={MATERIALITY}
                      />
                    ),
                  },
                  {
                    label: vocabulary.plural,
                    value: formatNumber(selected.conversions),
                    sub: (
                      <Delta
                        change={percentChange(
                          selected.conversions,
                          selected.previousConversions,
                        )}
                        higherIsBetter={true}
                        neutralBelow={MATERIALITY}
                      />
                    ),
                  },
                  {
                    label: vocabulary.costLabel,
                    value: formatMetric("cpa", selected.cpa, currency),
                    sub: (
                      <TargetLine cpa={selected.cpa} target={targetCpa} currency={currency} />
                    ),
                  },
                  {
                    label: showRoas ? "ROAS" : "CPC",
                    value: formatMetric(
                      showRoas ? "roas" : "cpc",
                      showRoas ? selected.roas : null,
                      currency,
                    ),
                    sub: (
                      <Delta
                        change={percentChange(selected.roas, selected.previousRoas)}
                        higherIsBetter={true}
                        neutralBelow={MATERIALITY}
                      />
                    ),
                  },
                  {
                    label: "CTR",
                    value: formatMetric("ctr", selected.ctr, currency),
                    sub: (
                      <Delta
                        change={percentChange(selected.ctr, selected.previousCtr)}
                        higherIsBetter={true}
                        neutralBelow={MATERIALITY}
                      />
                    ),
                  },
                ].map((m) => (
                  <div key={m.label} className="min-w-0 border-t border-border pt-3">
                    <dt className="truncate text-xs text-ink-muted">{m.label}</dt>
                    <dd className="mt-1 text-xl font-semibold tracking-[-0.02em] text-ink tabular">
                      {m.value}
                    </dd>
                    <dd className="mt-0.5 text-xs">{m.sub}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="mt-8">
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-medium text-ink-secondary">Daily spend</h3>
              <ul className="flex gap-4 text-xs text-ink-muted">
                <li className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-chart-primary" />
                  {currentLabel}
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 bg-chart-muted" />
                  {previousLabel} · day by day
                </li>
              </ul>
            </div>
            <div className="relative mt-4 mr-12 ml-12 h-[150px]">
              {chart.ticks.map((t) => (
                <div key={t.v} className="absolute inset-x-0" style={{ top: `${t.top}%` }}>
                  <div
                    className={cn("h-px", t.v === 0 ? "bg-border-strong" : "bg-chart-grid")}
                  />
                  <span className="absolute top-0 right-full mr-3 -translate-y-1/2 text-xs text-ink-muted tabular">
                    {formatCurrency(t.v, currency, { compact: true })}
                  </span>
                </div>
              ))}
              <svg
                aria-hidden
                className="absolute inset-0 h-full w-full overflow-visible"
                viewBox={`0 0 ${W} ${H}`}
                preserveAspectRatio="none"
              >
                <path
                  d={chart.pre.line}
                  fill="none"
                  stroke="var(--color-chart-muted)"
                  strokeWidth={1.75}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
                <path d={chart.cur.area} fill="var(--color-chart-primary)" fillOpacity={0.05} />
                <path
                  d={chart.cur.line}
                  fill="none"
                  stroke="var(--color-chart-primary)"
                  strokeWidth={2}
                  vectorEffect="non-scaling-stroke"
                  strokeLinecap="round"
                />
              </svg>
              <span
                className="absolute left-full ml-2 -translate-y-1/2 text-xs font-semibold text-ink tabular"
                style={{ top: `${chart.cur.pts[chart.cur.pts.length - 1].y}%` }}
              >
                {formatCurrency(
                  selected.spendSeries[selected.spendSeries.length - 1],
                  currency,
                )}
              </span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-10">
            <div>
              <h3 className="text-sm font-medium text-ink-secondary">Used in</h3>
              <ul className="mt-2 divide-y divide-border">
                {selected.usage.map((u, index) => (
                  <li
                    key={`${u.campaign}-${u.ad}-${index}`}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-ink" title={u.campaign}>
                        {u.campaign}
                      </span>
                      <span className="block truncate text-xs text-ink-muted">{u.ad}</span>
                    </span>
                    <span className="shrink-0 text-sm font-medium text-ink tabular">
                      {formatCurrency(u.spend, currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-ink-secondary">
                Compared with {comparison}
              </h3>
              <table className="mt-2 w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-ink-muted">
                    <th className="h-8 text-left font-medium">Metric</th>
                    <th className="h-8 text-right font-medium">Now</th>
                    <th className="h-8 text-right font-medium">Before</th>
                    <th className="h-8 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisons.map((row) => (
                    <tr key={row.label} className="border-b border-border last:border-0">
                      <td className="h-9 text-ink-secondary">{row.label}</td>
                      <td className="h-9 text-right font-medium text-ink tabular">
                        {row.current}
                      </td>
                      <td className="h-9 text-right text-ink-muted tabular">{row.previous}</td>
                      <td className="h-9 text-right">
                        <Delta
                          change={row.change}
                          higherIsBetter={row.higherIsBetter}
                          neutralBelow={MATERIALITY}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}

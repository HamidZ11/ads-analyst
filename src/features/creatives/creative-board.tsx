"use client";

import { useMemo, useRef, useState } from "react";
import { Delta } from "@/components/ui/delta";
import { Sparkline } from "@/components/ui/sparkline";
import { formatCurrency, formatMetric, formatNumber, formatPercent } from "@/domain/format";
import { CREATIVE_TYPE_LABELS } from "@/domain/labels";
import type { CreativeType } from "@/domain/types";
import { cn } from "@/lib/cn";
import type { CreativeBoardItem, CreativeBoardModel } from "./board-data";
import { CreativeArtwork } from "./creative-artwork";
import { CREATIVE_MATERIALITY, CreativeInspector } from "./creative-inspector";

type TypeFilter = "all" | CreativeType;
type SortKey = "spend" | "conversions" | "cpa" | "ctr" | "roas";

function sortValue(item: CreativeBoardItem, key: SortKey): number | null {
  switch (key) {
    case "spend":
      return item.current.spend;
    case "conversions":
      return item.current.conversions;
    case "cpa":
      return item.current.cpa;
    case "ctr":
      return item.current.ctr;
    case "roas":
      return item.current.roas;
  }
}

function meta(item: CreativeBoardItem): string {
  return `${CREATIVE_TYPE_LABELS[item.type]} · ${item.adCount} ${item.adCount === 1 ? "ad" : "ads"} · ${item.campaignCount} ${item.campaignCount === 1 ? "campaign" : "campaigns"}`;
}

function TargetLine({
  cpa,
  target,
  currency,
}: {
  cpa: number | null;
  target: number;
  currency: CreativeBoardModel["currency"];
}) {
  if (target <= 0 || cpa === null) return null;
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

function Metric({
  label,
  value,
  sub,
  strong = false,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-ink-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-semibold tracking-[-0.01em] text-ink tabular",
          strong ? "text-[18px] leading-6" : "text-[15px] leading-5",
        )}
      >
        {value}
      </p>
      {sub ? <div className="mt-0.5 text-xs">{sub}</div> : null}
    </div>
  );
}

/**
 * One selectable creative entry. A stretched button carries the interaction
 * and the pressed state; the content stays plain markup. Leaders get larger
 * artwork and five metrics; the rest get four.
 */
function Entry({
  item,
  rank,
  size,
  selected,
  onSelect,
  model,
}: {
  item: CreativeBoardItem;
  rank: number;
  size: "lead" | "standard";
  selected: boolean;
  onSelect: (trigger: HTMLButtonElement) => void;
  model: CreativeBoardModel;
}) {
  const { currency, vocabulary, showRoas, targetCpa } = model;
  const secondary = showRoas ? "roas" : "cpc";
  const lead = size === "lead";
  return (
    <article
      className={cn(
        "relative -mx-3 flex gap-5 rounded-md px-3 transition-colors",
        lead ? "py-5" : "py-4",
        selected
          ? "bg-surface-subtle before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-r before:bg-accent"
          : "hover:bg-surface-hover/60",
      )}
    >
      <button
        type="button"
        aria-pressed={selected}
        aria-label={`Inspect ${item.name}`}
        onClick={(event) => onSelect(event.currentTarget)}
        className="absolute inset-0 rounded-md focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      />
      <div className="pointer-events-none relative flex min-w-0 flex-1 gap-5">
        <CreativeArtwork
          thumbnail={item.thumbnail}
          type={item.type}
          width={lead ? 120 : 72}
          height={lead ? 150 : 90}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-muted tabular">
            <span
              className={cn(
                "font-medium",
                selected ? "text-accent-strong" : "text-ink-secondary",
              )}
            >
              #{rank}
            </span>
            <span aria-hidden> · </span>
            {meta(item)}
          </p>
          <h3
            className={cn(
              "mt-1 font-semibold tracking-[-0.01em] text-ink",
              lead ? "text-[16px] leading-6" : "line-clamp-2 text-[14px] leading-5",
            )}
          >
            {item.name}
          </h3>
          <div
            className={cn(
              "mt-4 grid gap-x-5",
              lead ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-5" : "grid-cols-2 sm:grid-cols-4",
            )}
          >
            <Metric
              label="Spend"
              value={formatCurrency(item.current.spend, currency)}
              sub={
                <Delta
                  change={item.change.spend}
                  higherIsBetter={null}
                  neutralBelow={CREATIVE_MATERIALITY}
                />
              }
              strong={lead}
            />
            <Metric
              label={vocabulary.plural}
              value={formatNumber(item.current.conversions)}
              sub={
                <Delta
                  change={item.change.conversions}
                  higherIsBetter={true}
                  neutralBelow={CREATIVE_MATERIALITY}
                />
              }
              strong={lead}
            />
            <Metric
              label={vocabulary.costLabel}
              value={formatMetric("cpa", item.current.cpa, currency)}
              sub={<TargetLine cpa={item.current.cpa} target={targetCpa} currency={currency} />}
              strong={lead}
            />
            <Metric
              label={showRoas ? "ROAS" : "CPC"}
              value={formatMetric(secondary, item.current[secondary], currency)}
              sub={
                showRoas ? (
                  <Delta
                    change={item.change.roas}
                    higherIsBetter={true}
                    neutralBelow={CREATIVE_MATERIALITY}
                  />
                ) : undefined
              }
              strong={lead}
            />
            {lead ? (
              <Metric
                label="CTR"
                value={formatMetric("ctr", item.current.ctr, currency)}
                sub={
                  <span className="flex items-center gap-2">
                    <Delta
                      change={item.change.ctr}
                      higherIsBetter={true}
                      neutralBelow={CREATIVE_MATERIALITY}
                    />
                    {item.ctrSeries.filter((v) => v !== null).length >= 6 ? (
                      <Sparkline
                        values={item.ctrSeries}
                        splitIndex={item.split}
                        width={64}
                        height={20}
                      />
                    ) : null}
                  </span>
                }
                strong
              />
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * The Creatives board (lab Concept C): type tabs with counts, the type
 * breakdown, the leaders by the active ranking, the remaining delivering
 * creatives in two ruled columns, and a quiet strip for creatives with no
 * delivery. Selecting an entry opens the inspector (lab Concept B).
 */
export function CreativeBoard({ model }: { model: CreativeBoardModel }) {
  const { items, types, currency, vocabulary, showRoas, comparison } = model;
  const [type, setType] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** The entry button that opened the inspector; focus returns to it on close. */
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const select = (id: string, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setSelectedId(id);
  };

  const sortLabels: Record<SortKey, string> = {
    spend: "Spend",
    conversions: vocabulary.plural,
    cpa: vocabulary.costLabel,
    ctr: "CTR",
    roas: "ROAS",
  };
  const rankWord = (key: SortKey) => {
    const label = sortLabels[key];
    return label === label.toUpperCase() ? label : label.toLowerCase();
  };

  const filtered = useMemo(
    () => items.filter((item) => type === "all" || item.type === type),
    [items, type],
  );
  const ranked = useMemo(() => {
    const ascending = sortKey === "cpa";
    return filtered
      .filter((item) => item.current.spend > 0)
      .sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return ascending ? av - bv : bv - av;
      });
  }, [filtered, sortKey]);
  const idle = filtered.filter((item) => item.current.spend === 0);
  const leaders = ranked.slice(0, 2);
  const rest = ranked.slice(2);
  const selected = ranked.find((item) => item.id === selectedId) ?? null;
  const selectedRank = selected ? ranked.indexOf(selected) + 1 : 0;

  const tabs: Array<{ value: TypeFilter; label: string; count: number }> = [
    { value: "all", label: "All", count: items.length },
    ...types.map((t) => ({ value: t.type, label: t.label, count: t.count })),
  ];

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-x-6">
          {tabs.map((tab) => {
            const pressed = type === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                  setType(tab.value);
                  setSelectedId(null);
                }}
                className={cn(
                  "-mb-px flex h-9 items-center gap-1.5 border-b-2 text-sm font-medium transition-colors",
                  pressed
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {tab.label}
                <span className="text-xs text-ink-faint tabular">{tab.count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-2">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Ranked by
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-8 max-w-[220px] rounded-md border border-border bg-surface px-2 text-sm text-ink transition-colors hover:border-border-strong focus-visible:border-accent-border"
            >
              <option value="spend">Spend</option>
              <option value="conversions">{vocabulary.plural}</option>
              <option value="cpa">{vocabulary.costLabel} (lowest first)</option>
              <option value="ctr">CTR</option>
              {showRoas ? <option value="roas">ROAS</option> : null}
            </select>
          </label>
          <p className="text-xs whitespace-nowrap text-ink-muted tabular">
            {ranked.length} delivering · {idle.length} idle
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 divide-y divide-border border-b border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {types.map((t, index) => (
          <div
            key={t.type}
            className={cn(
              "min-w-0 py-4 transition-colors",
              index > 0 && "sm:pl-6",
              index < types.length - 1 && "sm:pr-6",
              type === t.type && "bg-surface-subtle sm:-mx-0 sm:px-6",
            )}
          >
            <dt className="text-xs text-ink-muted">
              {t.label} <span className="text-ink-faint tabular">· {t.count}</span>
            </dt>
            <dd className="mt-1 flex items-baseline gap-3">
              <span className="text-[18px] leading-6 font-semibold tracking-[-0.01em] text-ink tabular">
                {formatPercent(t.share, 0)}
              </span>
              <span className="text-xs text-ink-muted tabular">
                of spend · {formatCurrency(t.spend, currency)}
              </span>
            </dd>
            <dd className="mt-0.5 text-xs text-ink-muted tabular">
              {formatNumber(t.conversions)} {vocabulary.plural.toLowerCase()} ·{" "}
              {showRoas
                ? `${formatMetric("roas", t.roas, currency)} ROAS`
                : `${formatMetric("cpa", t.cpa, currency)} ${vocabulary.costLabel.toLowerCase()}`}
            </dd>
          </div>
        ))}
      </dl>

      {ranked.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">
          No creatives of this type delivered in this period.
        </p>
      ) : (
        <>
          <section aria-labelledby="creatives-leading" className="mt-2">
            <h2 id="creatives-leading" className="pt-4 text-xs font-medium text-ink-muted">
              Leading by {rankWord(sortKey)}
            </h2>
            <div className="divide-y divide-border">
              {leaders.map((item, index) => (
                <Entry
                  key={item.id}
                  item={item}
                  rank={index + 1}
                  size="lead"
                  selected={selectedId === item.id}
                  onSelect={(trigger) => select(item.id, trigger)}
                  model={model}
                />
              ))}
            </div>
          </section>

          {rest.length > 0 ? (
            <section aria-labelledby="creatives-rest" className="mt-2 border-t border-border">
              <h2 id="creatives-rest" className="pt-4 text-xs font-medium text-ink-muted">
                All delivering creatives
                <span className="ml-2 text-ink-faint tabular">
                  ranked by {rankWord(sortKey)}
                </span>
              </h2>
              <div className="grid grid-cols-1 min-[1400px]:grid-cols-2 min-[1400px]:gap-x-10">
                {[0, 1].map((column) => (
                  <div
                    key={column}
                    className={cn(
                      "divide-y divide-border",
                      column === 1 &&
                        "min-[1400px]:border-l min-[1400px]:border-border min-[1400px]:pl-10",
                    )}
                  >
                    {rest
                      .filter((_, index) => index % 2 === column)
                      .map((item) => (
                        <Entry
                          key={item.id}
                          item={item}
                          rank={ranked.indexOf(item) + 1}
                          size="standard"
                          selected={selectedId === item.id}
                          onSelect={(trigger) => select(item.id, trigger)}
                          model={model}
                        />
                      ))}
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {idle.length > 0 ? (
        <section aria-labelledby="creatives-idle" className="mt-2 border-t border-border pt-4">
          <h2 id="creatives-idle" className="text-xs font-medium text-ink-muted">
            No delivery this period{" "}
            <span className="text-ink-faint tabular">· {idle.length}</span>
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-ink-muted">
            {idle.map((item) => (
              <li key={item.id} className="flex max-w-full items-center gap-2">
                <CreativeArtwork
                  thumbnail={item.thumbnail}
                  type={item.type}
                  width={20}
                  height={24}
                />
                <span className="truncate" title={item.name}>
                  {item.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-6 text-xs text-ink-muted">
        Changes compare with the {comparison}. Movements under 5% stay grey.
      </p>

      <CreativeInspector
        item={selected}
        rank={selectedRank}
        rankLabel={rankWord(sortKey)}
        model={model}
        returnFocusTo={triggerRef}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}

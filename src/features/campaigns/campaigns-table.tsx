"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Delta } from "@/components/ui/delta";
import { Input } from "@/components/ui/input";
import { Table } from "@/components/ui/table";
import { formatCurrency, formatMetric, formatNumber } from "@/domain/format";
import { OBJECTIVE_LABELS, STATUS_LABELS, type ConversionVocabulary } from "@/domain/labels";
import { deriveMetrics, percentChange, sumMetrics } from "@/domain/metrics";
import type { CurrencyCode, EntityStatus } from "@/domain/types";
import type { CampaignRow } from "@/features/analytics/queries";
import { cn } from "@/lib/cn";

/** Movement below this is shown neutral in the ledger. */
export const LEDGER_MATERIALITY = 0.05;

type StatusFilter = "all" | "active" | "paused";

type SortKey =
  | "name"
  | "spend"
  | "spendChange"
  | "conversions"
  | "conversionsChange"
  | "cpa"
  | "roas"
  | "cpc"
  | "ctr";

interface SortState {
  key: SortKey;
  direction: "asc" | "desc";
}

export interface CampaignsTableProps {
  rows: CampaignRow[];
  currency: CurrencyCode;
  vocabulary: ConversionVocabulary;
  comparison: string;
  showRoas: boolean;
  /** The client's cost-per-conversion target; 0 or less means none. */
  targetCpa: number;
}

const STATUS_DOT: Record<EntityStatus, string> = {
  active: "bg-positive",
  paused: "border border-ink-faint",
  archived: "bg-border-strong",
};

function sortValue(row: CampaignRow, key: SortKey): number | string | null {
  switch (key) {
    case "name":
      return row.campaign.name;
    case "spend":
      return row.current.totals.spend;
    case "spendChange":
      return row.spendChange;
    case "conversions":
      return row.current.totals.conversions;
    case "conversionsChange":
      return row.conversionsChange;
    case "cpa":
      return row.current.derived.cpa;
    case "roas":
      return row.current.derived.roas;
    case "cpc":
      return row.current.derived.cpc;
    case "ctr":
      return row.current.derived.ctr;
  }
}

function compare(
  a: number | string | null,
  b: number | string | null,
  direction: "asc" | "desc",
): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  const result =
    typeof a === "string" && typeof b === "string" ? a.localeCompare(b) : Number(a) - Number(b);
  return direction === "asc" ? result : -result;
}

function plural(count: number, singular: string, pluralForm: string) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Cost against the client's target, in the client's currency: "£110.83 over target". */
function TargetContext({
  cpa,
  target,
  currency,
}: {
  cpa: number | null;
  target: number;
  currency: CurrencyCode;
}) {
  if (target <= 0 || cpa === null) return null;
  const diff = cpa - target;
  if (Math.abs(diff) < 0.005) {
    return <p className="text-xs font-medium text-ink-muted">On target</p>;
  }
  return (
    <p className={cn("text-xs font-medium", diff > 0 ? "text-negative" : "text-positive")}>
      {formatCurrency(Math.abs(diff), currency, { decimals: 2 })} {diff > 0 ? "over" : "under"}{" "}
      target
    </p>
  );
}

/**
 * Campaign performance ledger (Concept B with target context from C): open
 * composition, Delivery / Outcome / Efficiency groups separated by gutters,
 * 56px entries led by the campaign identity, each change paired with the
 * value it compares to, and an aligned totals row. Sorting, search and the
 * status filter are real.
 */
export function CampaignsTable({
  rows,
  currency,
  vocabulary,
  comparison,
  showRoas,
  targetCpa,
}: CampaignsTableProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortState>({ key: "spend", direction: "desc" });
  const secondaryKey = showRoas ? "roas" : "cpc";

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => status === "all" || row.campaign.status === status)
      .filter((row) => q === "" || row.campaign.name.toLowerCase().includes(q))
      .sort((a, b) => compare(sortValue(a, sort.key), sortValue(b, sort.key), sort.direction));
  }, [rows, query, status, sort]);

  const totals = useMemo(() => {
    const current = sumMetrics(visible.map((r) => r.current.totals));
    const previous = sumMetrics(visible.map((r) => r.previous.totals));
    return { current, previous, derived: deriveMetrics(current) };
  }, [visible]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      active: rows.filter((r) => r.campaign.status === "active").length,
      paused: rows.filter((r) => r.campaign.status === "paused").length,
    }),
    [rows],
  );

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "name" ? "asc" : "desc" },
    );
  };

  const labels: Record<SortKey, string> = {
    name: "Campaign",
    spend: "Spend",
    spendChange: "Spend change",
    conversions: vocabulary.plural,
    conversionsChange: `${vocabulary.plural} change`,
    cpa: vocabulary.costLabel,
    roas: "ROAS",
    cpc: "CPC",
    ctr: "CTR",
  };

  const header = (
    key: SortKey,
    label: string,
    options: { numeric?: boolean; group?: boolean; edge?: "first" | "last" } = {},
  ) => {
    const { numeric = true, group = false, edge } = options;
    const active = sort.key === key;
    const Icon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
        className={cn(
          "group h-9 p-0 align-middle whitespace-nowrap",
          numeric ? "w-0 text-right" : "text-left",
          edge === "first" &&
            "sticky left-0 z-[1] border-r border-border bg-surface md:static md:border-r-0",
        )}
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={cn(
            "flex h-9 w-full items-center gap-1 text-xs font-medium transition-colors hover:text-ink",
            numeric ? "flex-row-reverse" : "",
            group ? "pl-6 min-[1400px]:pl-8" : edge === "first" ? "pl-0" : "pl-3",
            edge === "last" ? "pr-0" : "pr-3",
            active ? "text-ink" : "text-ink-muted",
          )}
        >
          {label}
          <Icon
            aria-hidden
            size={12}
            className={cn(
              "shrink-0 transition-opacity",
              active
                ? "text-accent"
                : "text-ink-faint opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
            )}
          />
        </button>
      </th>
    );
  };

  const tabs: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: "all", label: "All", count: counts.all },
    { value: "active", label: "Active", count: counts.active },
    { value: "paused", label: "Paused", count: counts.paused },
  ];
  const SortIcon = sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-border sm:flex-row sm:items-end sm:justify-between">
        <div role="group" aria-label="Filter by status" className="flex gap-6">
          {tabs.map((tab) => {
            const selected = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={selected}
                onClick={() => setStatus(tab.value)}
                className={cn(
                  "-mb-px flex h-9 items-center gap-1.5 border-b-2 text-sm font-medium transition-colors",
                  selected
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
        <div className="flex items-center gap-3 pb-2">
          <label className="sr-only" htmlFor="campaign-search">
            Search campaigns
          </label>
          <Input
            id="campaign-search"
            type="search"
            placeholder="Search campaigns"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leading={<Search size={14} />}
            className="sm:w-[240px]"
          />
          <p className="hidden items-center gap-1 text-xs whitespace-nowrap text-ink-muted sm:flex">
            Sorted by {labels[sort.key]}
            <SortIcon aria-hidden size={12} className="text-ink-faint" />
          </p>
        </div>
      </div>

      <Table
        caption={`Campaign performance for the selected period compared with the ${comparison}`}
        className="min-w-[880px]"
      >
        <thead>
          <tr className="text-xs text-ink-faint">
            <th scope="colgroup" className="h-8 pt-2 text-left" />
            <th
              scope="colgroup"
              colSpan={2}
              className="h-8 pt-2 pl-6 text-left font-normal min-[1400px]:pl-8"
            >
              <span className="block border-b border-border pb-1.5">Delivery</span>
            </th>
            <th
              scope="colgroup"
              colSpan={2}
              className="h-8 pt-2 pl-6 text-left font-normal min-[1400px]:pl-8"
            >
              <span className="block border-b border-border pb-1.5">Outcome</span>
            </th>
            <th
              scope="colgroup"
              colSpan={3}
              className="h-8 pt-2 pl-6 text-left font-normal min-[1400px]:pl-8"
            >
              <span className="block border-b border-border pb-1.5">Efficiency</span>
            </th>
          </tr>
          <tr className="border-b border-border">
            {header("name", "Campaign", { numeric: false, edge: "first" })}
            {header("spend", "Spend", { group: true })}
            {header("spendChange", "Change")}
            {header("conversions", vocabulary.plural, { group: true })}
            {header("conversionsChange", "Change")}
            {header("cpa", vocabulary.costLabel, { group: true })}
            {header(secondaryKey, showRoas ? "ROAS" : "CPC")}
            {header("ctr", "CTR", { edge: "last" })}
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={8} className="h-16 text-center text-sm text-ink-muted">
                No campaigns match the current filters.
              </td>
            </tr>
          ) : (
            visible.map((row) => {
              const { campaign, current, previous } = row;
              const paused = campaign.status !== "active";
              return (
                <tr
                  key={campaign.id}
                  className="h-14 border-b border-border bg-surface transition-colors hover:bg-surface-subtle"
                >
                  <td className="sticky left-0 z-[1] max-w-[200px] min-w-[180px] border-r border-border bg-inherit pr-3 align-middle min-[1400px]:max-w-[380px] md:static md:max-w-[272px] md:border-r-0">
                    <p
                      className={cn(
                        "truncate text-[14px] font-medium",
                        paused ? "text-ink-muted" : "text-ink",
                      )}
                      title={campaign.name}
                    >
                      {campaign.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs whitespace-nowrap text-ink-muted">
                      <span
                        aria-hidden
                        className={cn(
                          "size-1.5 shrink-0 rounded-full",
                          STATUS_DOT[campaign.status],
                        )}
                      />
                      <span>{STATUS_LABELS[campaign.status]}</span>
                      <span aria-hidden>·</span>
                      <span>
                        {OBJECTIVE_LABELS[campaign.objective]} ·{" "}
                        {plural(row.adSetCount, "ad set", "ad sets")} ·{" "}
                        {plural(row.adCount, "ad", "ads")}
                      </span>
                    </p>
                  </td>
                  <td className="pl-6 text-right align-middle text-[14px] font-semibold whitespace-nowrap text-ink tabular min-[1400px]:pl-8">
                    {formatCurrency(current.totals.spend, currency)}
                  </td>
                  <td className="px-3 text-right align-middle whitespace-nowrap tabular">
                    <p>
                      <Delta
                        change={row.spendChange}
                        higherIsBetter={null}
                        neutralBelow={LEDGER_MATERIALITY}
                      />
                    </p>
                    <p className="text-xs text-ink-faint">
                      from {formatCurrency(previous.totals.spend, currency)}
                    </p>
                  </td>
                  <td className="pl-6 text-right align-middle text-[14px] font-semibold whitespace-nowrap text-ink tabular min-[1400px]:pl-8">
                    {formatNumber(current.totals.conversions)}
                  </td>
                  <td className="px-3 text-right align-middle whitespace-nowrap tabular">
                    <p>
                      <Delta
                        change={row.conversionsChange}
                        higherIsBetter={true}
                        neutralBelow={LEDGER_MATERIALITY}
                      />
                    </p>
                    <p className="text-xs text-ink-faint">
                      from {formatNumber(previous.totals.conversions)}
                    </p>
                  </td>
                  <td className="pl-6 text-right align-middle whitespace-nowrap tabular min-[1400px]:pl-8">
                    <p className="font-medium text-ink">
                      {formatMetric("cpa", current.derived.cpa, currency)}
                    </p>
                    <TargetContext
                      cpa={current.derived.cpa}
                      target={targetCpa}
                      currency={currency}
                    />
                  </td>
                  <td className="px-3 text-right align-middle whitespace-nowrap text-ink-secondary tabular">
                    {formatMetric(secondaryKey, current.derived[secondaryKey], currency)}
                  </td>
                  <td className="pr-0 pl-3 text-right align-middle whitespace-nowrap text-ink-secondary tabular">
                    {formatMetric("ctr", current.derived.ctr, currency)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        {visible.length > 1 ? (
          <tfoot>
            <tr className="h-12 bg-surface text-sm">
              <td className="sticky left-0 z-[1] border-r border-border bg-inherit pr-3 align-middle whitespace-nowrap text-ink-muted md:static md:border-r-0">
                Total · {visible.length === rows.length ? "" : `${visible.length} of `}
                {rows.length} campaigns
              </td>
              <td className="pl-6 text-right align-middle font-semibold text-ink tabular min-[1400px]:pl-8">
                {formatCurrency(totals.current.spend, currency)}
              </td>
              <td className="px-3 text-right align-middle tabular">
                <Delta
                  change={percentChange(totals.current.spend, totals.previous.spend)}
                  higherIsBetter={null}
                  neutralBelow={LEDGER_MATERIALITY}
                />
              </td>
              <td className="pl-6 text-right align-middle font-semibold text-ink tabular min-[1400px]:pl-8">
                {formatNumber(totals.current.conversions)}
              </td>
              <td className="px-3 text-right align-middle tabular">
                <Delta
                  change={percentChange(
                    totals.current.conversions,
                    totals.previous.conversions,
                  )}
                  higherIsBetter={true}
                  neutralBelow={LEDGER_MATERIALITY}
                />
              </td>
              <td className="pl-6 text-right align-middle font-medium text-ink tabular min-[1400px]:pl-8">
                {formatMetric("cpa", totals.derived.cpa, currency)}
              </td>
              <td className="px-3 text-right align-middle text-ink-secondary tabular">
                {formatMetric(secondaryKey, totals.derived[secondaryKey], currency)}
              </td>
              <td className="pr-0 pl-3 text-right align-middle text-ink-secondary tabular">
                {formatMetric("ctr", totals.derived.ctr, currency)}
              </td>
            </tr>
          </tfoot>
        ) : null}
      </Table>
    </div>
  );
}

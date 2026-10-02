"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Delta } from "@/components/ui/delta";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Table, TBody, Td, TFoot, Th, THead, Tr } from "@/components/ui/table";
import { formatCurrency, formatMetric, formatNumber } from "@/domain/format";
import { OBJECTIVE_LABELS, type ConversionVocabulary } from "@/domain/labels";
import { deriveMetrics, sumMetrics } from "@/domain/metrics";
import type { CurrencyCode } from "@/domain/types";
import type { CampaignRow } from "@/features/analytics/queries";
import { cn } from "@/lib/cn";

type StatusFilter = "all" | "active" | "paused";

type SortKey =
  | "name"
  | "status"
  | "adSets"
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
}

function sortValue(row: CampaignRow, key: SortKey): number | string | null {
  switch (key) {
    case "name":
      return row.campaign.name;
    case "status":
      return row.campaign.status;
    case "adSets":
      return row.adSetCount;
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

const STATUS_OPTIONS = [
  { value: "all" as const, label: "All" },
  { value: "active" as const, label: "Active" },
  { value: "paused" as const, label: "Paused" },
];

/**
 * Dense, sortable campaign table. Structure is settled; this pass only refines
 * hierarchy: quiet sentence-case headers whose sort affordance appears on
 * hover, a stronger name column, and the toolbar sitting above the surface.
 */
export function CampaignsTable({
  rows,
  currency,
  vocabulary,
  comparison,
  showRoas,
}: CampaignsTableProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortState>({ key: "spend", direction: "desc" });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((row) => status === "all" || row.campaign.status === status)
      .filter((row) => q === "" || row.campaign.name.toLowerCase().includes(q))
      .sort((a, b) => compare(sortValue(a, sort.key), sortValue(b, sort.key), sort.direction));
  }, [rows, query, status, sort]);

  const totals = useMemo(() => {
    const summed = sumMetrics(visible.map((r) => r.current.totals));
    return { totals: summed, derived: deriveMetrics(summed) };
  }, [visible]);

  const toggleSort = (key: SortKey) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: key === "name" || key === "status" ? "asc" : "desc" },
    );
  };

  const header = (key: SortKey, label: string, numeric = false, title?: string) => {
    const active = sort.key === key;
    const Icon = active ? (sort.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <Th
        numeric={numeric}
        aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
        className="p-0 first:pl-0 last:pr-0"
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          title={title}
          className={cn(
            "group flex h-10 w-full items-center gap-1 px-3 text-xs font-medium transition-colors hover:text-ink [th:first-child>&]:pl-4 [th:last-child>&]:pr-4",
            numeric && "flex-row-reverse text-right",
            active ? "text-ink" : "text-ink-muted",
          )}
        >
          {label}
          <Icon
            aria-hidden
            size={12}
            className={cn(
              "transition-opacity",
              active
                ? "text-accent opacity-100"
                : "text-ink-faint opacity-0 group-hover:opacity-100",
            )}
          />
        </button>
      </Th>
    );
  };

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
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
            className="sm:max-w-xs"
          />
          <SegmentedControl
            label="Filter by status"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />
        </div>
        <p className="text-xs text-ink-muted tabular">
          {visible.length} of {rows.length} campaigns
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <Table
          caption={`Campaign performance for the selected period compared with the ${comparison}`}
        >
          <THead>
            <Tr>
              {header("name", "Campaign")}
              {header("status", "Status")}
              {header("adSets", "Ad sets", true)}
              {header("spend", "Spend", true)}
              {header("spendChange", "Δ", true, `Spend change vs ${comparison}`)}
              {header("conversions", vocabulary.plural, true)}
              {header(
                "conversionsChange",
                "Δ",
                true,
                `${vocabulary.plural} change vs ${comparison}`,
              )}
              {header("cpa", "CPA", true, vocabulary.costLabel)}
              {showRoas ? header("roas", "ROAS", true) : header("cpc", "CPC", true)}
              {header("ctr", "CTR", true)}
            </Tr>
          </THead>
          <TBody>
            {visible.length === 0 ? (
              <Tr>
                <Td colSpan={10} className="h-20 text-center text-sm text-ink-muted">
                  No campaigns match the current filters.
                </Td>
              </Tr>
            ) : (
              visible.map((row) => {
                const { campaign, current } = row;
                const delivering = current.totals.spend > 0;
                return (
                  <Tr
                    key={campaign.id}
                    className={cn("hover:bg-surface-subtle", !delivering && "text-ink-muted")}
                  >
                    <Td className="max-w-[380px]">
                      <span
                        className={cn(
                          "block truncate font-medium",
                          delivering ? "text-ink" : "text-ink-secondary",
                        )}
                      >
                        {campaign.name}
                      </span>
                      <span className="block text-xs text-ink-muted">
                        {OBJECTIVE_LABELS[campaign.objective]} · {row.adCount} ads
                      </span>
                    </Td>
                    <Td>
                      <StatusBadge status={campaign.status} />
                    </Td>
                    <Td numeric className="text-ink-secondary">
                      {row.adSetCount}
                    </Td>
                    <Td numeric className="font-medium text-ink">
                      {formatCurrency(current.totals.spend, currency)}
                    </Td>
                    <Td numeric>
                      <Delta change={row.spendChange} higherIsBetter={null} />
                    </Td>
                    <Td numeric className="text-ink-secondary">
                      {formatNumber(current.totals.conversions)}
                    </Td>
                    <Td numeric>
                      <Delta change={row.conversionsChange} higherIsBetter={true} />
                    </Td>
                    <Td numeric className="text-ink-secondary">
                      {formatMetric("cpa", current.derived.cpa, currency)}
                    </Td>
                    <Td numeric className="text-ink-secondary">
                      {showRoas
                        ? formatMetric("roas", current.derived.roas, currency)
                        : formatMetric("cpc", current.derived.cpc, currency)}
                    </Td>
                    <Td numeric className="text-ink-secondary">
                      {formatMetric("ctr", current.derived.ctr, currency)}
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
          {visible.length > 1 ? (
            <TFoot>
              <Tr className="border-t border-border">
                <Td className="text-xs text-ink-secondary" colSpan={3}>
                  Total · {visible.length} campaigns
                </Td>
                <Td numeric className="text-ink">
                  {formatCurrency(totals.totals.spend, currency)}
                </Td>
                <Td />
                <Td numeric className="text-ink">
                  {formatNumber(totals.totals.conversions)}
                </Td>
                <Td />
                <Td numeric className="text-ink">
                  {formatMetric("cpa", totals.derived.cpa, currency)}
                </Td>
                <Td numeric className="text-ink">
                  {showRoas
                    ? formatMetric("roas", totals.derived.roas, currency)
                    : formatMetric("cpc", totals.derived.cpc, currency)}
                </Td>
                <Td numeric className="text-ink">
                  {formatMetric("ctr", totals.derived.ctr, currency)}
                </Td>
              </Tr>
            </TFoot>
          ) : null}
        </Table>
      </div>
    </div>
  );
}

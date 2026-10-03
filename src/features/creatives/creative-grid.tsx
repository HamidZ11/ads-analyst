"use client";

import { useMemo, useState } from "react";
import { CreativeThumbnail } from "@/components/ui/creative-thumbnail";
import { Delta } from "@/components/ui/delta";
import { Input } from "@/components/ui/input";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { formatCurrency, formatMetric, formatNumber } from "@/domain/format";
import { CREATIVE_TYPE_LABELS, type ConversionVocabulary } from "@/domain/labels";
import type { CreativeType, CurrencyCode } from "@/domain/types";
import type { CreativeRow } from "@/features/analytics/queries";
import { cn } from "@/lib/cn";

type TypeFilter = "all" | CreativeType;
type SortKey = "spend" | "conversions" | "cpa" | "ctr" | "roas";

const TYPE_OPTIONS = [
  { value: "all" as const, label: "All" },
  { value: "image" as const, label: "Image" },
  { value: "video" as const, label: "Video" },
  { value: "carousel" as const, label: "Carousel" },
];

export interface CreativeGridProps {
  rows: CreativeRow[];
  currency: CurrencyCode;
  vocabulary: ConversionVocabulary;
  comparison: string;
  showRoas: boolean;
}

function sortValue(row: CreativeRow, key: SortKey): number | null {
  switch (key) {
    case "spend":
      return row.current.totals.spend;
    case "conversions":
      return row.current.totals.conversions;
    case "cpa":
      return row.current.derived.cpa;
    case "ctr":
      return row.current.derived.ctr;
    case "roas":
      return row.current.derived.roas;
  }
}

export function CreativeGrid({
  rows,
  currency,
  vocabulary,
  comparison,
  showRoas,
}: CreativeGridProps) {
  const [type, setType] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("spend");

  const visible = useMemo(() => {
    const ascending = sortKey === "cpa";
    return rows
      .filter((row) => type === "all" || row.creative.type === type)
      .filter((row) => row.creative.name.toLowerCase().includes(query.trim().toLowerCase()))
      .sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return ascending ? av - bv : bv - av;
      });
  }, [rows, type, query, sortKey]);

  const sortOptions: Array<{ value: SortKey; label: string }> = [
    { value: "spend", label: "Spend" },
    { value: "conversions", label: vocabulary.plural },
    { value: "cpa", label: "CPA (lowest first)" },
    { value: "ctr", label: "CTR" },
    ...(showRoas ? [{ value: "roas" as const, label: "ROAS" }] : []),
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="sr-only" htmlFor="creative-search">
            Search creatives
          </label>
          <Input
            id="creative-search"
            type="search"
            placeholder="Search creatives"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="sm:w-64"
          />
          <div className="flex items-center gap-1 text-xs text-ink-muted">
            {TYPE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setType(option.value)}
                className={cn(
                  "rounded-sm px-2 py-1.5 transition-colors",
                  type === option.value
                    ? "bg-accent-soft font-medium text-accent-strong"
                    : "hover:bg-surface-hover hover:text-ink",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-ink-muted">
            Sort by
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="h-8 rounded-md border border-border bg-surface px-2 text-sm text-ink hover:border-border-strong"
            >
              {sortOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-ink-muted tabular">
            {visible.length} of {rows.length}
          </p>
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong bg-surface-subtle p-6 text-center text-xs text-ink-muted">
          No creatives of this type.
        </p>
      ) : (
        <Table
          caption={`Creative performance compared with ${comparison}`}
          wrapperClassName="rounded-md border border-border bg-surface"
        >
          <THead>
            <Tr>
              <Th>Rank</Th>
              <Th>Creative</Th>
              <Th numeric>Spend</Th>
              <Th numeric>{vocabulary.plural}</Th>
              <Th numeric>{vocabulary.costLabel}</Th>
              <Th numeric>{showRoas ? "ROAS" : "CPC"}</Th>
              <Th numeric>CTR</Th>
              <Th numeric>Change</Th>
            </Tr>
          </THead>
          <TBody>
            {visible.map((row, index) => {
              const current = row.current;
              const delivering = current.totals.spend > 0;
              return (
                <Tr key={row.creative.id} className="hover:bg-surface-subtle">
                  <Td className="w-14 text-xs text-ink-faint tabular">
                    {String(index + 1).padStart(2, "0")}
                  </Td>
                  <Td className="max-w-[420px] min-w-[260px]">
                    <div className="flex items-center gap-3">
                      <CreativeThumbnail
                        thumbnail={row.creative.thumbnail}
                        type={row.creative.type}
                        frame="square"
                        size="sm"
                        className="w-12 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{row.creative.name}</p>
                        <p className="mt-0.5 truncate text-xs text-ink-muted">
                          {CREATIVE_TYPE_LABELS[row.creative.type]} · {row.ads.length}{" "}
                          {row.ads.length === 1 ? "ad" : "ads"} · {row.campaigns.length}{" "}
                          {row.campaigns.length === 1 ? "campaign" : "campaigns"}
                        </p>
                      </div>
                    </div>
                  </Td>
                  <Td numeric className="font-medium text-ink">
                    {formatCurrency(current.totals.spend, currency)}
                  </Td>
                  <Td numeric>{formatNumber(current.totals.conversions)}</Td>
                  <Td numeric>{formatMetric("cpa", current.derived.cpa, currency)}</Td>
                  <Td numeric>
                    {showRoas
                      ? formatMetric("roas", current.derived.roas, currency)
                      : formatMetric("cpc", current.derived.cpc, currency)}
                  </Td>
                  <Td numeric>{formatMetric("ctr", current.derived.ctr, currency)}</Td>
                  <Td numeric>
                    {delivering ? (
                      <Delta change={row.ctrChange} higherIsBetter={true} neutralBelow={0.03} />
                    ) : (
                      <span className="text-ink-faint">—</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}
    </div>
  );
}

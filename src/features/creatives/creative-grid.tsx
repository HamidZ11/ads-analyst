"use client";

import { useMemo, useState } from "react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ConversionVocabulary } from "@/domain/labels";
import type { CreativeType, CurrencyCode } from "@/domain/types";
import type { CreativeRow } from "@/features/analytics/queries";
import { CreativeCard } from "./creative-card";

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
  splitIndex: number;
  periodDays: number;
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
  splitIndex,
  periodDays,
}: CreativeGridProps) {
  const [type, setType] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("spend");

  const visible = useMemo(() => {
    const ascending = sortKey === "cpa";
    return rows
      .filter((row) => type === "all" || row.creative.type === type)
      .sort((a, b) => {
        const av = sortValue(a, sortKey);
        const bv = sortValue(b, sortKey);
        if (av === null && bv === null) return 0;
        if (av === null) return 1;
        if (bv === null) return -1;
        return ascending ? av - bv : bv - av;
      });
  }, [rows, type, sortKey]);

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
        <SegmentedControl
          label="Filter by creative type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={setType}
        />
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
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visible.map((row) => (
            <li key={row.creative.id} className="flex">
              <div className="flex w-full">
                <CreativeCard
                  row={row}
                  currency={currency}
                  vocabulary={vocabulary}
                  comparison={comparison}
                  showRoas={showRoas}
                  splitIndex={splitIndex}
                  periodDays={periodDays}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

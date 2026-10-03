import { ArrowDownWideNarrow } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDateRange, formatMetric, formatNumber } from "@/domain/format";
import { OBJECTIVE_LABELS } from "@/domain/labels";
import { cn } from "@/lib/cn";
import { Change, SearchField, SortHeader, StatusDot } from "./cells";
import type { CampaignsLab } from "./data";
import { StaticPresets } from "./lab-frame";

/**
 * Concept B — Campaign Performance Ledger. Open table, two-tier header that
 * groups Delivery / Outcome / Efficiency with gutters rather than borders,
 * 56px entries with a 14px identity line and a second line of metadata,
 * previous values beneath each change, and an aligned account line.
 */
export function ConceptB({ lab }: { lab: CampaignsLab }) {
  const { workspace, client, rows, vocabulary, showRoas, totals, derived, comparison, counts } =
    lab;
  const { currency } = client;
  const secondary = showRoas ? "roas" : "cpc";
  const tabs = [
    { label: "All", count: counts.all, selected: true },
    { label: "Active", count: counts.active, selected: false },
    { label: "Paused", count: counts.paused, selected: false },
  ];
  return (
    <>
      <PageHeader
        title="Campaigns"
        description={`${client.name} · ${rows.length} campaigns · ${counts.delivering} delivering`}
        actions={
          <>
            <span className="text-xs text-ink-muted md:text-right">
              <span className="block font-medium text-ink-secondary">
                {formatDateRange(workspace.periods.current)}
              </span>
              <span className="mt-0.5 block">vs {comparison}</span>
            </span>
            <StaticPresets selected={workspace.preset} />
          </>
        }
      />

      <div className="flex items-end justify-between gap-4 border-b border-border">
        <div className="flex gap-6">
          {tabs.map((tab) => (
            <span
              key={tab.label}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium",
                tab.selected
                  ? "border-accent text-ink"
                  : "border-transparent text-ink-muted hover:text-ink",
              )}
            >
              {tab.label}
              <span className="text-xs text-ink-faint tabular">{tab.count}</span>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 pb-2">
          <SearchField className="w-[240px]" />
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-secondary">
            <ArrowDownWideNarrow aria-hidden size={14} className="text-ink-muted" />
            Spend
          </span>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Campaign performance ledger, Concept B</caption>
        <thead>
          <tr className="text-xs text-ink-faint">
            <th scope="colgroup" className="h-8 pt-2 text-left" />
            <th scope="colgroup" colSpan={2} className="h-8 pt-2 pl-8 text-left font-normal">
              <span className="block border-b border-border pb-1.5">Delivery</span>
            </th>
            <th scope="colgroup" colSpan={2} className="h-8 pt-2 pl-8 text-left font-normal">
              <span className="block border-b border-border pb-1.5">Outcome</span>
            </th>
            <th scope="colgroup" colSpan={3} className="h-8 pt-2 pl-8 text-left font-normal">
              <span className="block border-b border-border pb-1.5">Efficiency</span>
            </th>
          </tr>
          <tr className="border-b border-border">
            <SortHeader className="pl-0 text-left">Campaign</SortHeader>
            <SortHeader numeric active className="pl-8 text-right">
              Spend
            </SortHeader>
            <SortHeader numeric className="text-right">
              Change
            </SortHeader>
            <SortHeader numeric className="pl-8 text-right">
              {vocabulary.plural}
            </SortHeader>
            <SortHeader numeric className="text-right">
              Change
            </SortHeader>
            <SortHeader numeric className="pl-8 text-right">
              {vocabulary.costLabel}
            </SortHeader>
            <SortHeader numeric className="text-right">
              {showRoas ? "ROAS" : "CPC"}
            </SortHeader>
            <SortHeader numeric className="pr-0 text-right">
              CTR
            </SortHeader>
          </tr>
        </thead>
        <tbody>
          {rows.map(
            ({
              campaign,
              current,
              previous,
              adSetCount,
              adCount,
              spendChange,
              conversionsChange,
            }) => {
              const paused = campaign.status !== "active";
              return (
                <tr
                  key={campaign.id}
                  className="h-14 border-b border-border transition-colors hover:bg-surface-subtle"
                >
                  <td className="max-w-[360px] pr-3 align-middle">
                    <p
                      className={cn(
                        "truncate text-[14px] font-medium",
                        paused ? "text-ink-muted" : "text-ink",
                      )}
                      title={campaign.name}
                    >
                      {campaign.name}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                      <StatusDot status={campaign.status} withLabel />
                      <span aria-hidden>·</span>
                      {OBJECTIVE_LABELS[campaign.objective]} · {adSetCount} ad sets · {adCount}{" "}
                      ads
                    </p>
                  </td>
                  <td className="pl-8 text-right align-middle text-[14px] font-semibold text-ink tabular">
                    {formatCurrency(current.totals.spend, currency)}
                  </td>
                  <td className="px-3 text-right align-middle tabular">
                    <p>
                      <Change change={spendChange} higherIsBetter={null} />
                    </p>
                    <p className="text-xs text-ink-faint">
                      from {formatCurrency(previous.totals.spend, currency)}
                    </p>
                  </td>
                  <td className="pl-8 text-right align-middle text-[14px] font-semibold text-ink tabular">
                    {formatNumber(current.totals.conversions)}
                  </td>
                  <td className="px-3 text-right align-middle tabular">
                    <p>
                      <Change change={conversionsChange} higherIsBetter={true} />
                    </p>
                    <p className="text-xs text-ink-faint">
                      from {formatNumber(previous.totals.conversions)}
                    </p>
                  </td>
                  <td className="pl-8 text-right align-middle tabular">
                    <p className="font-medium text-ink">
                      {formatMetric("cpa", current.derived.cpa, currency)}
                    </p>
                    <p className="text-xs text-ink-faint">
                      target {formatCurrency(client.targetCpa, currency)}
                    </p>
                  </td>
                  <td className="px-3 text-right align-middle text-ink-secondary tabular">
                    {formatMetric(secondary, current.derived[secondary], currency)}
                  </td>
                  <td className="pr-0 pl-3 text-right align-middle text-ink-secondary tabular">
                    {formatMetric("ctr", current.derived.ctr, currency)}
                  </td>
                </tr>
              );
            },
          )}
        </tbody>
        <tfoot>
          <tr className="h-12 text-sm">
            <td className="pr-3 text-ink-muted">
              All {rows.length} campaigns
              <span className="ml-2 text-xs text-ink-faint">account total</span>
            </td>
            <td className="pl-8 text-right font-semibold text-ink tabular">
              {formatCurrency(totals.spend, currency)}
            </td>
            <td className="px-3 text-right">
              <Change
                change={
                  lab.previousTotals.spend
                    ? (totals.spend - lab.previousTotals.spend) / lab.previousTotals.spend
                    : null
                }
                higherIsBetter={null}
              />
            </td>
            <td className="pl-8 text-right font-semibold text-ink tabular">
              {formatNumber(totals.conversions)}
            </td>
            <td className="px-3 text-right">
              <Change
                change={
                  lab.previousTotals.conversions
                    ? (totals.conversions - lab.previousTotals.conversions) /
                      lab.previousTotals.conversions
                    : null
                }
                higherIsBetter={true}
              />
            </td>
            <td className="pl-8 text-right font-medium text-ink tabular">
              {formatMetric("cpa", derived.cpa, currency)}
            </td>
            <td className="px-3 text-right text-ink-secondary tabular">
              {formatMetric(secondary, derived[secondary], currency)}
            </td>
            <td className="pr-0 pl-3 text-right text-ink-secondary tabular">
              {formatMetric("ctr", derived.ctr, currency)}
            </td>
          </tr>
        </tfoot>
      </table>
    </>
  );
}

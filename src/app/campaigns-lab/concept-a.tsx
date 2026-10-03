import { SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { formatCurrency, formatDateRange, formatMetric, formatNumber } from "@/domain/format";
import { OBJECTIVE_LABELS } from "@/domain/labels";
import { Change, SearchField, Segmented, SortHeader, StatusDot } from "./cells";
import type { CampaignsLab } from "./data";
import { StaticPresets } from "./lab-frame";

/**
 * Concept A — Refined Analytical Table. The closest evolution of the current
 * page: one framed table, metrics paired with their change in the same cell,
 * status as a dot and a word, a quiet totals row.
 */
export function ConceptA({ lab }: { lab: CampaignsLab }) {
  const { workspace, client, rows, vocabulary, showRoas, totals, derived, comparison, counts } =
    lab;
  const { currency } = client;
  const secondary = showRoas ? "roas" : "cpc";
  return (
    <>
      <PageHeader
        title="Campaigns"
        description={`${client.name} · ${rows.length} campaigns`}
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

      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SearchField className="w-[240px]" />
          <Segmented options={["All", "Active", "Paused"]} selected="All" />
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-muted tabular">{counts.all} campaigns</span>
          <span className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-ink-secondary">
            <SlidersHorizontal aria-hidden size={14} className="text-ink-muted" />
            Columns
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Campaign performance, Concept A</caption>
          <thead>
            <tr className="border-b border-border bg-surface-subtle">
              <SortHeader className="pl-4 text-left">Campaign</SortHeader>
              <SortHeader className="text-left">Status</SortHeader>
              <SortHeader numeric className="text-right">
                Ad sets
              </SortHeader>
              <SortHeader numeric active className="text-right">
                Spend
              </SortHeader>
              <SortHeader numeric className="text-right">
                {vocabulary.plural}
              </SortHeader>
              <SortHeader numeric className="text-right">
                {vocabulary.costLabel}
              </SortHeader>
              <SortHeader numeric className="text-right">
                {showRoas ? "ROAS" : "CPC"}
              </SortHeader>
              <SortHeader numeric className="pr-4 text-right">
                CTR
              </SortHeader>
            </tr>
          </thead>
          <tbody>
            {rows.map(
              ({ campaign, current, adSetCount, adCount, spendChange, conversionsChange }) => {
                const paused = campaign.status !== "active";
                return (
                  <tr
                    key={campaign.id}
                    className="h-12 border-b border-border transition-colors last:border-b-0 hover:bg-surface-hover"
                  >
                    <td className="max-w-[380px] pl-4 align-middle">
                      <p
                        className={`truncate text-sm font-medium ${paused ? "text-ink-muted" : "text-ink"}`}
                        title={campaign.name}
                      >
                        {campaign.name}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {OBJECTIVE_LABELS[campaign.objective]} · {adSetCount} ad sets ·{" "}
                        {adCount} ads
                      </p>
                    </td>
                    <td className="px-3 align-middle">
                      <StatusDot status={campaign.status} withLabel />
                    </td>
                    <td className="px-3 text-right align-middle text-ink-muted tabular">
                      {adSetCount}
                    </td>
                    <td className="px-3 text-right align-middle tabular">
                      <p className="font-medium text-ink">
                        {formatCurrency(current.totals.spend, currency)}
                      </p>
                      <p className="text-xs">
                        <Change change={spendChange} higherIsBetter={null} />
                      </p>
                    </td>
                    <td className="px-3 text-right align-middle tabular">
                      <p className="font-medium text-ink">
                        {formatNumber(current.totals.conversions)}
                      </p>
                      <p className="text-xs">
                        <Change change={conversionsChange} higherIsBetter={true} />
                      </p>
                    </td>
                    <td className="px-3 text-right align-middle text-ink-secondary tabular">
                      {formatMetric("cpa", current.derived.cpa, currency)}
                    </td>
                    <td className="px-3 text-right align-middle text-ink-secondary tabular">
                      {formatMetric(secondary, current.derived[secondary], currency)}
                    </td>
                    <td className="px-3 pr-4 text-right align-middle text-ink-secondary tabular">
                      {formatMetric("ctr", current.derived.ctr, currency)}
                    </td>
                  </tr>
                );
              },
            )}
          </tbody>
          <tfoot>
            <tr className="h-10 border-t border-border bg-surface-subtle text-sm font-medium">
              <td className="pl-4 text-ink-secondary" colSpan={3}>
                Total · {rows.length} campaigns
              </td>
              <td className="px-3 text-right text-ink tabular">
                {formatCurrency(totals.spend, currency)}
              </td>
              <td className="px-3 text-right text-ink tabular">
                {formatNumber(totals.conversions)}
              </td>
              <td className="px-3 text-right text-ink tabular">
                {formatMetric("cpa", derived.cpa, currency)}
              </td>
              <td className="px-3 text-right text-ink tabular">
                {formatMetric(secondary, derived[secondary], currency)}
              </td>
              <td className="px-3 pr-4 text-right text-ink tabular">
                {formatMetric("ctr", derived.ctr, currency)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Changes compare with {comparison}. Movements under 5% stay grey.
      </p>
    </>
  );
}

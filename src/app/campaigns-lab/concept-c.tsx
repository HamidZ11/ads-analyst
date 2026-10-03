import { PageHeader } from "@/components/ui/page-header";
import { Sparkline } from "@/components/ui/sparkline";
import {
  formatCurrency,
  formatDateRange,
  formatMetric,
  formatNumber,
  formatPercent,
} from "@/domain/format";
import { OBJECTIVE_LABELS } from "@/domain/labels";
import { percentChange } from "@/domain/metrics";
import { cn } from "@/lib/cn";
import { Change, SearchField, Segmented, SortHeader, StatusDot } from "./cells";
import type { CampaignsLab } from "./data";
import { StaticPresets } from "./lab-frame";

/**
 * Concept C — Campaign Command Table. A compact strip of account facts above
 * a framed table whose rows carry small signals: a daily-conversions trend,
 * the cost's position against the client's target as a bar and a sentence,
 * and a hollow dot for paused campaigns. Facts only, no classifications.
 */
export function ConceptC({ lab }: { lab: CampaignsLab }) {
  const {
    workspace,
    client,
    campaigns,
    rows,
    vocabulary,
    showRoas,
    totals,
    derived,
    previousTotals,
    comparison,
    counts,
    movers,
  } = lab;
  const { currency, targetCpa } = client;
  const secondary = showRoas ? "roas" : "cpc";
  const lead = movers[0];
  const facts = [
    {
      label: "Spend",
      value: formatCurrency(totals.spend, currency),
      detail: (
        <Change
          change={percentChange(totals.spend, previousTotals.spend)}
          higherIsBetter={null}
        />
      ),
    },
    {
      label: vocabulary.plural,
      value: formatNumber(totals.conversions),
      detail: (
        <Change
          change={percentChange(totals.conversions, previousTotals.conversions)}
          higherIsBetter={true}
        />
      ),
    },
    {
      label: `Over ${formatCurrency(targetCpa, currency)} target`,
      value: `${counts.overTarget} of ${counts.delivering}`,
      detail: <span className="text-ink-muted">delivering campaigns</span>,
    },
    {
      label: "Largest movement",
      value: lead ? (
        <span className="truncate" title={lead.campaign.name}>
          {lead.campaign.name.split(" | ").pop()}
        </span>
      ) : (
        "None"
      ),
      detail: lead ? (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-ink-muted">{lead.label}</span>
          <Change change={lead.change} higherIsBetter={lead.higherIsBetter} />
        </span>
      ) : null,
    },
  ];

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

      <dl className="grid grid-cols-4 divide-x divide-border border-y border-border">
        {facts.map((fact, index) => (
          <div key={index} className={cn("min-w-0 py-3", index > 0 && "pl-6")}>
            <dt className="text-xs text-ink-muted">{fact.label}</dt>
            <dd className="mt-1 truncate text-xl font-semibold tracking-[-0.02em] text-ink tabular">
              {fact.value}
            </dd>
            <dd className="mt-0.5 text-xs">{fact.detail}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <SearchField className="w-[240px]" />
          <Segmented options={["All", "Active", "Paused"]} selected="All" />
        </div>
        <span className="text-xs text-ink-muted tabular">
          Sorted by spend · {counts.all} campaigns
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Campaign command table, Concept C</caption>
          <thead>
            <tr className="border-b border-border">
              <SortHeader className="pl-4 text-left">Campaign</SortHeader>
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
            {campaigns.map(({ row, conversionSeries, overTarget }) => {
              const { campaign, current, adSetCount, adCount, spendChange, conversionsChange } =
                row;
              const cpa = current.derived.cpa;
              const paused = campaign.status !== "active";
              const gap = cpa === null ? null : cpa - targetCpa;
              const fill = cpa === null ? 0 : Math.min(100, (cpa / (targetCpa * 2)) * 100);
              return (
                <tr
                  key={campaign.id}
                  className="h-[52px] border-b border-border transition-colors last:border-b-0 hover:bg-surface-hover"
                >
                  <td className="max-w-[360px] pl-4 align-middle">
                    <p className="flex items-center gap-2">
                      <StatusDot status={campaign.status} />
                      <span
                        className={cn(
                          "truncate text-sm font-medium",
                          paused ? "text-ink-muted" : "text-ink",
                        )}
                        title={campaign.name}
                      >
                        {campaign.name}
                      </span>
                    </p>
                    <p className="pl-3.5 text-xs text-ink-muted">
                      {OBJECTIVE_LABELS[campaign.objective]} · {adSetCount} ad sets · {adCount}{" "}
                      ads
                    </p>
                  </td>
                  <td className="px-3 text-right align-middle tabular">
                    <p className="font-semibold text-ink">
                      {formatCurrency(current.totals.spend, currency)}
                    </p>
                    <p className="text-xs">
                      <Change change={spendChange} higherIsBetter={null} />
                    </p>
                  </td>
                  <td className="px-3 text-right align-middle tabular">
                    <div className="flex items-center justify-end gap-3">
                      <div>
                        <p className="font-semibold text-ink">
                          {formatNumber(current.totals.conversions)}
                        </p>
                        <p className="text-xs">
                          <Change change={conversionsChange} higherIsBetter={true} />
                        </p>
                      </div>
                      <Sparkline values={conversionSeries} width={56} height={18} />
                    </div>
                  </td>
                  <td className="px-3 text-right align-middle tabular">
                    <div className="flex items-center justify-end gap-3">
                      <div>
                        <p className="font-medium text-ink">
                          {formatMetric("cpa", cpa, currency)}
                        </p>
                        <p
                          className={cn(
                            "text-xs font-medium",
                            overTarget === null
                              ? "text-ink-faint"
                              : overTarget
                                ? "text-negative"
                                : "text-positive",
                          )}
                        >
                          {gap === null
                            ? "—"
                            : `${formatCurrency(Math.abs(gap), currency, { decimals: 2 })} ${overTarget ? "over" : "under"}`}
                        </p>
                      </div>
                      <span
                        aria-hidden
                        className="relative block h-1.5 w-14 shrink-0 rounded-full bg-surface-active"
                      >
                        <span
                          className={cn(
                            "absolute inset-y-0 left-0 rounded-full",
                            overTarget ? "bg-negative" : "bg-accent",
                          )}
                          style={{ width: `${fill}%` }}
                        />
                        <span className="absolute -top-0.5 left-1/2 h-2.5 w-px bg-ink" />
                      </span>
                    </div>
                  </td>
                  <td className="px-3 text-right align-middle text-ink-secondary tabular">
                    {formatMetric(secondary, current.derived[secondary], currency)}
                  </td>
                  <td className="px-3 pr-4 text-right align-middle text-ink-secondary tabular">
                    {formatMetric("ctr", current.derived.ctr, currency)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="h-10 border-t border-border bg-surface-subtle text-sm font-medium">
              <td className="pl-4 text-ink-secondary">
                All {rows.length} campaigns ·{" "}
                <span className="text-ink-muted">
                  {formatPercent(
                    totals.spend
                      ? campaigns
                          .filter((c) => c.overTarget)
                          .reduce((s, c) => s + c.row.current.totals.spend, 0) / totals.spend
                      : 0,
                    0,
                  )}{" "}
                  of spend over target
                </span>
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
    </>
  );
}

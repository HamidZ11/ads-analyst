import { ArrowDown } from "lucide-react";
import { Sparkline } from "@/components/ui/sparkline";
import { formatCurrency, formatMetric, formatNumber } from "@/domain/format";
import { CREATIVE_TYPE_LABELS } from "@/domain/labels";
import { cn } from "@/lib/cn";
import type { CreativesLab } from "./data";
import { Artwork, Change, LabHeader, TargetLine, TypeTabs, meta } from "./shared";

function Head({
  children,
  numeric = true,
  active = false,
  className,
}: {
  children: React.ReactNode;
  numeric?: boolean;
  active?: boolean;
  className?: string;
}) {
  return (
    <th
      scope="col"
      aria-sort={active ? "descending" : "none"}
      className={cn(
        "h-9 align-middle text-xs font-medium whitespace-nowrap",
        numeric ? "text-right" : "text-left",
        active ? "text-ink" : "text-ink-muted",
        className,
      )}
    >
      <span className={cn("inline-flex items-center gap-1", numeric && "flex-row-reverse")}>
        {children}
        {active ? <ArrowDown aria-hidden size={12} className="text-accent" /> : null}
      </span>
    </th>
  );
}

/**
 * Concept A — Creative Performance Ledger. The Campaigns ledger applied to
 * creatives: rank, 56×70 artwork inside the identity, Delivery / Outcome /
 * Efficiency groups, 72px entries, one 14-point CTR trend per row.
 */
export function ConceptA({ lab }: { lab: CreativesLab }) {
  const {
    client,
    creatives,
    vocabulary,
    showRoas,
    totals,
    derived,
    previousTotals,
    comparison,
  } = lab;
  const { currency, targetCpa } = client;
  const secondary = showRoas ? "roas" : "cpc";
  return (
    <>
      <LabHeader lab={lab} />
      <div className="flex items-end justify-between gap-4 border-b border-border">
        <TypeTabs lab={lab} />
        <p className="pb-2.5 text-xs text-ink-muted tabular">
          Ranked by spend · {lab.rows.length} creatives
        </p>
      </div>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Creative performance ledger, Concept A</caption>
        <thead>
          <tr className="text-xs text-ink-faint">
            <th scope="colgroup" colSpan={2} className="h-8 pt-2" />
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
            <Head numeric={false} className="w-8 pr-0">
              <span className="sr-only">Rank</span>
              <span aria-hidden>#</span>
            </Head>
            <Head numeric={false}>Creative</Head>
            <Head active className="pl-8">
              Spend
            </Head>
            <Head>Change</Head>
            <Head className="pl-8">{vocabulary.plural}</Head>
            <Head>Change</Head>
            <Head className="pl-8">{vocabulary.costLabel}</Head>
            <Head>{showRoas ? "ROAS" : "CPC"}</Head>
            <Head className="pr-0">CTR</Head>
          </tr>
        </thead>
        <tbody>
          {creatives.map((c, index) => {
            const { row } = c;
            const { creative, current, previous } = row;
            const delivering = current.totals.spend > 0;
            return (
              <tr
                key={creative.id}
                className="h-[72px] border-b border-border transition-colors hover:bg-surface-subtle"
              >
                <td className="w-8 pr-0 align-middle text-xs text-ink-faint tabular">
                  {index + 1}
                </td>
                <td className="max-w-[360px] min-w-[300px] py-0 pr-3 align-middle">
                  <div className="flex items-center gap-3">
                    <Artwork
                      thumbnail={creative.thumbnail}
                      type={creative.type}
                      width={56}
                      height={70}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "line-clamp-2 text-[14px] leading-5 font-medium",
                          delivering ? "text-ink" : "text-ink-muted",
                        )}
                        title={creative.name}
                      >
                        {creative.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-ink-muted">
                        {meta(
                          {
                            type: creative.type,
                            adCount: row.ads.length,
                            campaignCount: row.campaigns.length,
                          },
                          CREATIVE_TYPE_LABELS[creative.type],
                        )}
                      </p>
                    </div>
                  </div>
                </td>
                {delivering ? (
                  <>
                    <td className="pl-8 text-right align-middle text-[14px] font-semibold whitespace-nowrap text-ink tabular">
                      {formatCurrency(current.totals.spend, currency)}
                    </td>
                    <td className="px-3 text-right align-middle whitespace-nowrap tabular">
                      <p>
                        <Change change={row.spendChange} higherIsBetter={null} />
                      </p>
                      <p className="text-xs text-ink-faint">
                        from {formatCurrency(previous.totals.spend, currency)}
                      </p>
                    </td>
                    <td className="pl-8 text-right align-middle text-[14px] font-semibold whitespace-nowrap text-ink tabular">
                      {formatNumber(current.totals.conversions)}
                    </td>
                    <td className="px-3 text-right align-middle whitespace-nowrap tabular">
                      <p>
                        <Change change={c.conversionsChange} higherIsBetter={true} />
                      </p>
                      <p className="text-xs text-ink-faint">
                        from {formatNumber(previous.totals.conversions)}
                      </p>
                    </td>
                    <td className="pl-8 text-right align-middle whitespace-nowrap tabular">
                      <p className="font-medium text-ink">
                        {formatMetric("cpa", current.derived.cpa, currency)}
                      </p>
                      <TargetLine
                        cpa={current.derived.cpa}
                        target={targetCpa}
                        currency={currency}
                      />
                    </td>
                    <td className="px-3 text-right align-middle whitespace-nowrap text-ink-secondary tabular">
                      {formatMetric(secondary, current.derived[secondary], currency)}
                    </td>
                    <td className="pr-0 pl-3 align-middle whitespace-nowrap">
                      <div className="flex items-center justify-end gap-3">
                        <div className="text-right tabular">
                          <p className="text-ink-secondary">
                            {formatMetric("ctr", current.derived.ctr, currency)}
                          </p>
                          <p className="text-xs">
                            <Change change={row.ctrChange} higherIsBetter={true} />
                          </p>
                        </div>
                        <Sparkline
                          values={row.ctrSeries}
                          splitIndex={c.split}
                          width={64}
                          height={20}
                        />
                      </div>
                    </td>
                  </>
                ) : (
                  <td
                    colSpan={7}
                    className="pl-8 text-right align-middle text-sm text-ink-muted"
                  >
                    No delivery in this period
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="h-12 text-sm">
            <td colSpan={2} className="pr-3 text-ink-muted">
              All {lab.rows.length} creatives
              <span className="ml-2 text-xs text-ink-faint">
                {lab.delivering.length} delivering
              </span>
            </td>
            <td className="pl-8 text-right font-semibold text-ink tabular">
              {formatCurrency(totals.spend, currency)}
            </td>
            <td className="px-3 text-right">
              <Change
                change={
                  previousTotals.spend
                    ? (totals.spend - previousTotals.spend) / previousTotals.spend
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
                  previousTotals.conversions
                    ? (totals.conversions - previousTotals.conversions) /
                      previousTotals.conversions
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
      <p className="mt-3 text-xs text-ink-muted">
        Changes compare with the {comparison}. Movements under 5% stay grey. CTR trend spans
        both periods, grey then blue.
      </p>
    </>
  );
}

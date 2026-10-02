import type { ReactNode } from "react";
import { CreativeThumbnail } from "@/components/ui/creative-thumbnail";
import { Delta } from "@/components/ui/delta";
import { Sparkline } from "@/components/ui/sparkline";
import { formatCurrency, formatMetric, formatNumber } from "@/domain/format";
import { CREATIVE_TYPE_LABELS, type ConversionVocabulary } from "@/domain/labels";
import type { CurrencyCode } from "@/domain/types";
import type { CreativeRow } from "@/features/analytics/queries";

export interface CreativeCardProps {
  row: CreativeRow;
  currency: CurrencyCode;
  vocabulary: ConversionVocabulary;
  comparison: string;
  showRoas: boolean;
  splitIndex: number;
  periodDays: number;
}

function Metric({ label, value, delta }: { label: string; value: string; delta?: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold text-ink tabular">{value}</dd>
      {delta ? <dd className="mt-0.5">{delta}</dd> : null}
    </div>
  );
}

/**
 * Editorial creative card: artwork first, then title, then a quiet metric
 * row. Hover darkens the frame only; drilldown arrives with creative analysis.
 */
export function CreativeCard({
  row,
  currency,
  vocabulary,
  comparison,
  showRoas,
  splitIndex,
  periodDays,
}: CreativeCardProps) {
  const { creative, current } = row;
  const delivering = current.totals.spend > 0;
  const usage = [
    CREATIVE_TYPE_LABELS[creative.type],
    `${row.ads.length} ${row.ads.length === 1 ? "ad" : "ads"}`,
    `${row.campaigns.length} ${row.campaigns.length === 1 ? "campaign" : "campaigns"}`,
  ].join(" · ");

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-border-strong">
      <CreativeThumbnail
        thumbnail={creative.thumbnail}
        type={creative.type}
        frame="wide"
        size="lg"
        className="rounded-none"
      />
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs text-ink-muted">{usage}</p>
        <h3
          className="mt-1 line-clamp-2 text-sm font-semibold tracking-tight text-ink"
          title={creative.name}
        >
          {creative.name}
        </h3>

        {delivering ? (
          <>
            <dl className="mt-4 grid grid-cols-4 gap-3 border-t border-border pt-3.5">
              <Metric
                label="Spend"
                value={formatCurrency(current.totals.spend, currency)}
                delta={<Delta change={row.spendChange} higherIsBetter={null} />}
              />
              <Metric
                label={vocabulary.plural}
                value={formatNumber(current.totals.conversions)}
              />
              <Metric
                label="CPA"
                value={formatMetric("cpa", current.derived.cpa, currency)}
                delta={<Delta change={row.cpaChange} higherIsBetter={false} />}
              />
              {showRoas ? (
                <Metric
                  label="ROAS"
                  value={formatMetric("roas", current.derived.roas, currency)}
                />
              ) : (
                <Metric
                  label="CPC"
                  value={formatMetric("cpc", current.derived.cpc, currency)}
                />
              )}
            </dl>
            <div className="mt-auto flex items-end justify-between gap-3 pt-4">
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">CTR · {periodDays * 2} days</p>
                <p className="mt-0.5 flex items-baseline gap-1.5 text-sm font-semibold text-ink tabular">
                  {formatMetric("ctr", current.derived.ctr, currency)}
                  <Delta change={row.ctrChange} higherIsBetter={true} />
                  <span className="sr-only">vs {comparison}</span>
                </p>
              </div>
              <Sparkline
                values={row.ctrSeries}
                splitIndex={splitIndex}
                width={96}
                height={28}
              />
            </div>
          </>
        ) : (
          <p className="mt-4 border-t border-border pt-3.5 text-xs text-ink-muted">
            No delivery in this period.
          </p>
        )}
      </div>
    </article>
  );
}

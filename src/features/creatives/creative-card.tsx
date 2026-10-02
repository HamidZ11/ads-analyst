import { Badge } from "@/components/ui/badge";
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

function Metric({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-2xs font-medium tracking-wide text-ink-muted uppercase">{label}</dt>
      <dd className="mt-0.5 flex items-baseline gap-1.5 tabular">
        <span className="text-sm font-semibold text-ink">{value}</span>
        {delta}
      </dd>
    </div>
  );
}

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
    `${row.ads.length} ${row.ads.length === 1 ? "ad" : "ads"}`,
    `${row.campaigns.length} ${row.campaigns.length === 1 ? "campaign" : "campaigns"}`,
  ].join(" · ");

  return (
    <article className="flex flex-col rounded-lg border border-border bg-surface shadow-xs">
      <div className="flex gap-3 p-3">
        <CreativeThumbnail
          thumbnail={creative.thumbnail}
          type={creative.type}
          frame="square"
          size="sm"
          className="w-16 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-medium text-ink" title={creative.name}>
            {creative.name}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-2xs text-ink-muted">
            <Badge>{CREATIVE_TYPE_LABELS[creative.type]}</Badge>
            <span>{usage}</span>
          </p>
        </div>
      </div>

      {delivering ? (
        <>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-3 border-t border-border px-3 py-3">
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
              <Metric label="CPC" value={formatMetric("cpc", current.derived.cpc, currency)} />
            )}
          </dl>
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-border bg-surface-subtle px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-2xs font-medium tracking-wide text-ink-muted uppercase">
                CTR · {periodDays * 2} days
              </p>
              <p className="mt-0.5 flex items-baseline gap-1.5 text-sm font-semibold text-ink tabular">
                {formatMetric("ctr", current.derived.ctr, currency)}
                <Delta change={row.ctrChange} higherIsBetter={true} />
                <span className="sr-only">vs {comparison}</span>
              </p>
            </div>
            <Sparkline values={row.ctrSeries} splitIndex={splitIndex} width={96} height={28} />
          </div>
        </>
      ) : (
        <p className="mt-auto border-t border-border px-3 py-3 text-xs text-ink-muted">
          No delivery in this period.
        </p>
      )}
    </article>
  );
}

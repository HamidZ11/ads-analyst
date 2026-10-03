import { Sparkline } from "@/components/ui/sparkline";
import { formatCurrency, formatMetric, formatNumber, formatPercent } from "@/domain/format";
import { CREATIVE_TYPE_LABELS } from "@/domain/labels";
import type { ConversionVocabulary } from "@/domain/labels";
import type { CurrencyCode } from "@/domain/types";
import { cn } from "@/lib/cn";
import type { CreativesLab, LabCreative } from "./data";
import { Artwork, Change, LabHeader, TargetLine, TypeTabs, meta } from "./shared";

interface EntryContext {
  currency: CurrencyCode;
  targetCpa: number;
  vocabulary: ConversionVocabulary;
  showRoas: boolean;
}

function Metric({
  label,
  value,
  sub,
  strong = false,
  className,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <p className="truncate text-xs text-ink-muted">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-semibold tracking-[-0.01em] tabular",
          strong ? "text-[18px] leading-6 text-ink" : "text-[15px] leading-5 text-ink",
        )}
      >
        {value}
      </p>
      {sub ? <div className="mt-0.5 text-xs">{sub}</div> : null}
    </div>
  );
}

function Entry({
  c,
  size,
  ctx,
}: {
  c: LabCreative;
  size: "lead" | "standard";
  ctx: EntryContext;
}) {
  const { currency, targetCpa, vocabulary, showRoas } = ctx;
  const secondary = showRoas ? "roas" : "cpc";
  const { row } = c;
  const { creative, current } = row;
  const lead = size === "lead";
  return (
    <article className={cn("flex gap-5", lead ? "py-6" : "py-5")}>
      <Artwork
        thumbnail={creative.thumbnail}
        type={creative.type}
        width={lead ? 120 : 72}
        height={lead ? 150 : 90}
      />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-muted">
          {meta(
            {
              type: creative.type,
              adCount: row.ads.length,
              campaignCount: row.campaigns.length,
            },
            CREATIVE_TYPE_LABELS[creative.type],
          )}
        </p>
        <h3
          className={cn(
            "mt-1 font-semibold tracking-[-0.01em] text-ink",
            lead ? "text-[16px] leading-6" : "line-clamp-2 text-[14px] leading-5",
          )}
          title={creative.name}
        >
          {creative.name}
        </h3>
        <div className={cn("mt-4 grid gap-x-6", lead ? "grid-cols-5" : "grid-cols-4")}>
          <Metric
            label="Spend"
            value={formatCurrency(current.totals.spend, currency)}
            sub={<Change change={row.spendChange} higherIsBetter={null} />}
            strong={lead}
          />
          <Metric
            label={vocabulary.plural}
            value={formatNumber(current.totals.conversions)}
            sub={<Change change={c.conversionsChange} higherIsBetter={true} />}
            strong={lead}
          />
          <Metric
            label={vocabulary.costLabel}
            value={formatMetric("cpa", current.derived.cpa, currency)}
            sub={
              <TargetLine cpa={current.derived.cpa} target={targetCpa} currency={currency} />
            }
            strong={lead}
          />
          <Metric
            label={showRoas ? "ROAS" : "CPC"}
            value={formatMetric(secondary, current.derived[secondary], currency)}
            strong={lead}
          />
          {lead ? (
            <Metric
              label="CTR"
              value={formatMetric("ctr", current.derived.ctr, currency)}
              sub={
                <span className="flex items-center gap-2">
                  <Change change={row.ctrChange} higherIsBetter={true} />
                  <Sparkline
                    values={row.ctrSeries}
                    splitIndex={c.split}
                    width={64}
                    height={20}
                  />
                </span>
              }
              strong
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

/**
 * Concept C — Analytical Creative Board. Open composition: a type breakdown
 * strip, the two leading creatives by spend as full-width entries with larger
 * artwork and five metrics, then the rest as horizontal entries in two
 * ruled columns. No cards; hierarchy from artwork size and type.
 */
export function ConceptC({ lab }: { lab: CreativesLab }) {
  const { client, creatives, delivering, vocabulary, showRoas, totals, types, comparison } =
    lab;
  const { currency } = client;
  const targetCpa = client.targetCpa ?? 0;
  const ctx: EntryContext = { currency, targetCpa, vocabulary, showRoas };
  const leaders = delivering.slice(0, 2);
  const rest = delivering.slice(2);
  const idle = creatives.filter((c) => c.row.current.totals.spend === 0);

  return (
    <>
      <LabHeader lab={lab} />
      <div className="flex items-end justify-between gap-4 border-b border-border">
        <TypeTabs lab={lab} />
        <p className="pb-2.5 text-xs text-ink-muted tabular">
          Ranked by spend · {delivering.length} delivering
        </p>
      </div>

      <dl className="grid grid-cols-3 divide-x divide-border border-b border-border py-4">
        {types.map((t, index) => (
          <div key={t.type} className={cn("min-w-0", index > 0 && "pl-6")}>
            <dt className="text-xs text-ink-muted">
              {t.label} <span className="text-ink-faint">· {t.count}</span>
            </dt>
            <dd className="mt-1 flex items-baseline gap-3">
              <span className="text-[18px] leading-6 font-semibold tracking-[-0.01em] text-ink tabular">
                {formatPercent(t.share, 0)}
              </span>
              <span className="text-xs text-ink-muted tabular">
                of spend · {formatCurrency(t.spend, currency)}
              </span>
            </dd>
            <dd className="mt-0.5 text-xs text-ink-muted tabular">
              {formatNumber(t.conversions)} {vocabulary.plural.toLowerCase()} ·{" "}
              {showRoas
                ? `${formatMetric("roas", t.roas, currency)} ROAS`
                : `${formatMetric("cpa", t.cpa, currency)}`}
            </dd>
          </div>
        ))}
      </dl>

      <section className="mt-2">
        <h2 className="pt-4 text-xs font-medium text-ink-muted">Leading by spend</h2>
        <div className="divide-y divide-border">
          {leaders.map((c) => (
            <Entry key={c.row.creative.id} c={c} size="lead" ctx={ctx} />
          ))}
        </div>
      </section>

      <section className="mt-2 border-t border-border">
        <h2 className="pt-4 text-xs font-medium text-ink-muted">
          All delivering creatives
          <span className="ml-2 text-ink-faint tabular">
            {formatCurrency(totals.spend, currency)} total spend
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-x-10">
          {[0, 1].map((column) => (
            <div
              key={column}
              className={cn(
                "divide-y divide-border",
                column === 1 && "border-l border-border pl-10",
              )}
            >
              {rest
                .filter((_, index) => index % 2 === column)
                .map((c) => (
                  <Entry key={c.row.creative.id} c={c} size="standard" ctx={ctx} />
                ))}
            </div>
          ))}
        </div>
      </section>

      {idle.length > 0 ? (
        <section className="mt-2 border-t border-border pt-4">
          <h2 className="text-xs font-medium text-ink-muted">
            No delivery in this period{" "}
            <span className="text-ink-faint tabular">· {idle.length}</span>
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-muted">
            {idle.map((c) => (
              <li key={c.row.creative.id} className="flex items-center gap-2">
                <Artwork
                  thumbnail={c.row.creative.thumbnail}
                  type={c.row.creative.type}
                  width={20}
                  height={24}
                />
                <span className="truncate" title={c.row.creative.name}>
                  {c.row.creative.name}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="mt-6 text-xs text-ink-muted">
        Changes compare with the {comparison}. Movements under 5% stay grey.
      </p>
    </>
  );
}

import { Delta } from "@/components/ui/delta";
import { formatCurrency, formatNumber } from "@/domain/format";
import type { ConversionVocabulary } from "@/domain/labels";
import { percentChange, sumMetrics } from "@/domain/metrics";
import type { Client } from "@/domain/types";
import { rankCampaignMovers, type CampaignRow } from "@/features/analytics/queries";
import { LEDGER_MATERIALITY } from "./campaigns-table";

/** The last segment of a Meta-style "stage | audience | product" name, or the whole name. */
function shortName(name: string): string {
  const parts = name.split(" | ");
  return parts[parts.length - 1] ?? name;
}

/**
 * One quiet row of account facts above the ledger: spend and outcomes with
 * their change, campaigns over the cost target (when one exists) and the
 * largest campaign movement from the existing deterministic ranking.
 */
export function CampaignsSummary({
  rows,
  client,
  vocabulary,
  comparison,
}: {
  rows: CampaignRow[];
  client: Client;
  vocabulary: ConversionVocabulary;
  comparison: string;
}) {
  const current = sumMetrics(rows.map((r) => r.current.totals));
  const previous = sumMetrics(rows.map((r) => r.previous.totals));
  const delivering = rows.filter((r) => r.current.totals.spend > 0);
  const targetCpa = client.targetCpa !== null && client.targetCpa > 0 ? client.targetCpa : null;
  const overTarget =
    targetCpa !== null
      ? delivering.filter(
          (r) => r.current.derived.cpa !== null && r.current.derived.cpa > targetCpa,
        ).length
      : null;
  const lead = rankCampaignMovers(rows, vocabulary.plural)[0];

  return (
    <dl className="mb-6 grid grid-cols-2 gap-y-4 border-b border-border pb-5 md:grid-cols-4 md:divide-x md:divide-border">
      <div className="min-w-0 md:pr-6">
        <dt className="text-xs text-ink-muted">Spend</dt>
        <dd className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink tabular">
          {formatCurrency(current.spend, client.currency)}
        </dd>
        <dd className="mt-0.5 text-xs text-ink-muted">
          <Delta
            change={percentChange(current.spend, previous.spend)}
            higherIsBetter={null}
            neutralBelow={LEDGER_MATERIALITY}
          />{" "}
          vs {comparison}
        </dd>
      </div>
      <div className="min-w-0 md:px-6">
        <dt className="text-xs text-ink-muted">{vocabulary.plural}</dt>
        <dd className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink tabular">
          {formatNumber(current.conversions)}
        </dd>
        <dd className="mt-0.5 text-xs text-ink-muted">
          <Delta
            change={percentChange(current.conversions, previous.conversions)}
            higherIsBetter={true}
            neutralBelow={LEDGER_MATERIALITY}
          />{" "}
          vs {comparison}
        </dd>
      </div>
      <div className="min-w-0 md:px-6">
        {overTarget !== null ? (
          <>
            <dt className="text-xs text-ink-muted">
              Over {formatCurrency(targetCpa, client.currency)} target
            </dt>
            <dd className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink tabular">
              {overTarget} of {delivering.length}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-muted">delivering campaigns</dd>
          </>
        ) : (
          <>
            <dt className="text-xs text-ink-muted">Delivering</dt>
            <dd className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink tabular">
              {delivering.length} of {rows.length}
            </dd>
            <dd className="mt-0.5 text-xs text-ink-muted">campaigns with spend</dd>
          </>
        )}
      </div>
      <div className="min-w-0 md:pl-6">
        <dt className="text-xs text-ink-muted">Largest movement</dt>
        {lead ? (
          <>
            <dd
              className="mt-1 truncate text-lg font-semibold tracking-[-0.01em] text-ink"
              title={lead.campaign.name}
            >
              {shortName(lead.campaign.name)}
            </dd>
            <dd className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
              <span>{lead.label}</span>
              <Delta
                change={lead.change}
                higherIsBetter={lead.higherIsBetter}
                neutralBelow={LEDGER_MATERIALITY}
              />
            </dd>
          </>
        ) : (
          <>
            <dd className="mt-1 text-lg font-semibold tracking-[-0.01em] text-ink">None</dd>
            <dd className="mt-0.5 text-xs text-ink-muted">no material movement</dd>
          </>
        )}
      </div>
    </dl>
  );
}

import { Delta } from "@/components/ui/delta";
import { formatChange, formatCurrency, formatMetric, formatMultiple } from "@/domain/format";
import { conversionVocabulary, primaryMetricKeys } from "@/domain/labels";
import { METRIC_DEFINITIONS } from "@/domain/metrics";
import type { Client, MetricKey } from "@/domain/types";
import { getKpiReadings, type ClientPeriodSummary } from "@/features/analytics/queries";
import type { Workspace } from "@/features/workspace/server";
import { cn } from "@/lib/cn";

function kpiLabel(key: MetricKey, client: Client): string {
  const vocab = conversionVocabulary(client.type);
  if (key === "conversions") return vocab.plural;
  if (key === "cpa") return vocab.costLabel;
  return METRIC_DEFINITIONS[key].label;
}

function kpiValue(key: MetricKey, value: number | null, client: Client): string {
  if (key === "spend" || key === "revenue")
    return formatCurrency(value, client.currency, { compact: true });
  if (key === "conversions")
    return formatMetric(key, value, client.currency, { compact: true });
  return formatMetric(key, value, client.currency);
}

/** Position against the client's target, stated as a fact. */
function targetNote(key: MetricKey, value: number | null, client: Client): string | null {
  if (value === null) return null;
  if (key === "cpa") {
    const gap = (value - client.targetCpa) / client.targetCpa;
    const word = gap <= 0 ? "under" : "over";
    return `${formatChange(Math.abs(gap)).replace("+", "")} ${word} ${formatCurrency(client.targetCpa, client.currency)} target`;
  }
  if (key === "roas" && client.targetRoas !== null) {
    const gap = (value - client.targetRoas) / client.targetRoas;
    const word = gap >= 0 ? "above" : "below";
    return `${formatChange(Math.abs(gap)).replace("+", "")} ${word} ${formatMultiple(client.targetRoas, 1)} target`;
  }
  return null;
}

export interface KpiBandProps {
  workspace: Workspace;
  summary: ClientPeriodSummary;
  /** Metric currently drawn in the chart below; marked with the accent rule. */
  chartedKey?: MetricKey;
}

/**
 * One grouped metric band rather than six cards: hairline dividers, a quiet
 * label, a strong numeral, the change against the baseline, and the target
 * position where one exists.
 */
export function KpiBand({ workspace, summary, chartedKey = "spend" }: KpiBandProps) {
  const { client, comparison } = workspace;
  const readings = getKpiReadings(summary, primaryMetricKeys(client));

  return (
    <section
      aria-label="Key metrics"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 xl:grid-cols-6"
    >
      {readings.map((reading) => {
        const charted = reading.key === chartedKey;
        const note = targetNote(reading.key, reading.current, client);
        return (
          <div key={reading.key} className="relative bg-surface px-5 pt-4 pb-4">
            {charted ? (
              <span aria-hidden className="absolute inset-x-0 top-0 h-0.5 bg-accent" />
            ) : null}
            <p
              className={cn(
                "flex items-center gap-1.5 text-xs font-medium",
                charted ? "text-accent-strong" : "text-ink-muted",
              )}
            >
              {kpiLabel(reading.key, client)}
            </p>
            <p className="mt-2.5 text-2xl font-semibold tracking-tight whitespace-nowrap text-ink">
              {kpiValue(reading.key, reading.current, client)}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
              <Delta
                change={reading.change}
                higherIsBetter={METRIC_DEFINITIONS[reading.key].higherIsBetter}
              />
              <span>vs {comparison}</span>
            </p>
            {note ? <p className="mt-1 text-xs text-ink-faint">{note}</p> : null}
          </div>
        );
      })}
    </section>
  );
}

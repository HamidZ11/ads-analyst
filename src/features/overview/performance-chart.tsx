import { LineChart } from "@/components/ui/line-chart";
import { formatCurrency, formatDateRange, formatNumber } from "@/domain/format";
import { conversionVocabulary } from "@/domain/labels";
import type { DailyPoint } from "@/domain/metrics";
import type { Workspace } from "@/features/workspace/server";

function Legend() {
  return (
    <ul className="flex items-center gap-4 text-xs text-ink-muted" aria-label="Legend">
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-chart-primary" />
        Selected period
      </li>
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="h-0.5 w-3.5 rounded-full bg-chart-muted" />
        Earlier
      </li>
    </ul>
  );
}

/**
 * The dominant visual on the Overview: daily spend over the trailing window
 * with the selected period in blue, and a compact conversions line beneath.
 * Open framing, no card chrome.
 */
export function PerformanceChart({
  workspace,
  series,
}: {
  workspace: Workspace;
  series: DailyPoint[];
}) {
  const { client, periods } = workspace;
  const vocab = conversionVocabulary(client.type);
  const range = {
    start: series[0]?.date ?? periods.current.start,
    end: series.at(-1)?.date ?? periods.current.end,
  };
  const currentStart = periods.current.start > range.start ? periods.current.start : undefined;

  return (
    <section aria-labelledby="performance-heading" className="min-w-0">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="performance-heading" className="text-sm font-semibold text-ink">
            Daily spend
          </h2>
          <p className="mt-0.5 text-xs text-ink-muted">{formatDateRange(range)}</p>
        </div>
        <Legend />
      </div>
      <LineChart
        className="mt-5"
        points={series.map((p) => ({ date: p.date, value: p.spend }))}
        formatValue={(v) => formatCurrency(v, client.currency, { compact: true })}
        currentStart={currentStart}
        height={240}
      />
      <div className="mt-8 border-t border-border pt-5">
        <h3 className="text-sm font-semibold text-ink">Daily {vocab.plural.toLowerCase()}</h3>
        <LineChart
          className="mt-4"
          points={series.map((p) => ({ date: p.date, value: p.conversions }))}
          formatValue={(v) => formatNumber(v)}
          currentStart={currentStart}
          height={120}
        />
      </div>
    </section>
  );
}

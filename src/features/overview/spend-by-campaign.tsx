import { formatCurrency, formatPercent } from "@/domain/format";
import type { CampaignRow } from "@/features/analytics/queries";
import type { Workspace } from "@/features/workspace/server";

const VISIBLE = 6;

/** Open ranked list; neutral bars so blue keeps its meaning elsewhere. */
export function SpendByCampaign({
  workspace,
  rows,
}: {
  workspace: Workspace;
  rows: CampaignRow[];
}) {
  const { client } = workspace;
  const sorted = rows
    .filter((r) => r.current.totals.spend > 0)
    .sort((a, b) => b.current.totals.spend - a.current.totals.spend);
  const total = sorted.reduce((sum, r) => sum + r.current.totals.spend, 0);
  const visible = sorted.slice(0, VISIBLE);
  const rest = sorted.slice(VISIBLE);
  const restSpend = rest.reduce((sum, r) => sum + r.current.totals.spend, 0);
  const max = visible[0]?.current.totals.spend ?? 1;

  const bars = [
    ...visible.map((r) => ({
      id: r.campaign.id,
      name: r.campaign.name,
      spend: r.current.totals.spend,
    })),
    ...(rest.length > 0
      ? [{ id: "other", name: `${rest.length} other campaigns`, spend: restSpend }]
      : []),
  ];

  return (
    <section aria-labelledby="spend-share-heading" className="min-w-0">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="spend-share-heading" className="text-sm font-semibold text-ink">
          Spend by campaign
        </h2>
        <p className="text-xs text-ink-muted tabular">
          {formatCurrency(total, client.currency)} total
        </p>
      </div>
      {bars.length === 0 ? (
        <p className="mt-4 text-sm text-ink-muted">No spend recorded in this period.</p>
      ) : (
        <ol className="mt-4 flex flex-col gap-3.5">
          {bars.map((bar) => (
            <li key={bar.id} className="min-w-0">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-ink">{bar.name}</span>
                <span className="shrink-0 text-ink-secondary tabular">
                  {formatCurrency(bar.spend, client.currency)}
                  <span className="ml-2 text-xs text-ink-faint">
                    {formatPercent(total ? bar.spend / total : 0, 0)}
                  </span>
                </span>
              </div>
              <div aria-hidden className="mt-1.5 h-1 w-full rounded-full bg-surface-active">
                <div
                  className="h-1 rounded-full bg-chart-muted"
                  style={{ width: `${Math.max(1.5, (bar.spend / max) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

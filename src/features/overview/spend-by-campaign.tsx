import { Layers } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/domain/format";
import type { CampaignRow } from "@/features/analytics/queries";
import type { Workspace } from "@/features/workspace/server";

const VISIBLE = 6;

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
    <Card>
      <CardHeader
        icon={Layers}
        title="Spend by campaign"
        description={`${formatCurrency(total, client.currency)} across ${sorted.length} delivering campaigns`}
      />
      <CardBody>
        {bars.length === 0 ? (
          <p className="text-xs text-ink-muted">No spend recorded in this period.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {bars.map((bar) => (
              <li key={bar.id} className="min-w-0">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-ink">{bar.name}</span>
                  <span className="shrink-0 text-ink-secondary tabular">
                    {formatCurrency(bar.spend, client.currency)}
                    <span className="ml-1.5 text-ink-faint">
                      {formatPercent(total ? bar.spend / total : 0, 0)}
                    </span>
                  </span>
                </div>
                <div aria-hidden className="mt-1.5 h-1.5 w-full rounded-full bg-accent-soft">
                  <div
                    className="h-1.5 rounded-full bg-accent"
                    style={{ width: `${Math.max(2, (bar.spend / max) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

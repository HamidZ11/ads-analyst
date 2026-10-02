import { Activity } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { LineChart } from "@/components/ui/line-chart";
import { formatCurrency, formatDateRange, formatNumber } from "@/domain/format";
import { conversionVocabulary } from "@/domain/labels";
import type { DailyPoint } from "@/domain/metrics";
import type { Workspace } from "@/features/workspace/server";

export function TrendFrame({
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
    <Card>
      <CardHeader
        icon={Activity}
        title="Daily trend"
        description={formatDateRange(range)}
        actions={
          <ul className="flex items-center gap-3 text-2xs text-ink-muted" aria-label="Legend">
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-primary" />
              Selected period
            </li>
            <li className="flex items-center gap-1.5">
              <span aria-hidden className="h-0.5 w-3 rounded-full bg-chart-muted" />
              Earlier
            </li>
          </ul>
        }
      />
      <CardBody className="flex flex-col gap-6">
        <figure>
          <figcaption className="mb-2 text-xs font-medium text-ink-secondary">Spend</figcaption>
          <LineChart
            points={series.map((p) => ({ date: p.date, value: p.spend }))}
            formatValue={(v) => formatCurrency(v, client.currency, { compact: true })}
            currentStart={currentStart}
            height={150}
          />
        </figure>
        <figure>
          <figcaption className="mb-2 text-xs font-medium text-ink-secondary">
            {vocab.plural}
          </figcaption>
          <LineChart
            points={series.map((p) => ({ date: p.date, value: p.conversions }))}
            formatValue={(v) => formatNumber(v)}
            currentStart={currentStart}
            height={110}
          />
        </figure>
      </CardBody>
    </Card>
  );
}

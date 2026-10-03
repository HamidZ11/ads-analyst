import Link from "next/link";
import { ArrowUpRight, Check, CircleAlert, Layers3 } from "lucide-react";
import { Delta } from "@/components/ui/delta";
import { Sparkline } from "@/components/ui/sparkline";
import { formatCurrency, formatMetric, formatPercent } from "@/domain/format";
import { conversionVocabulary, tracksRevenue } from "@/domain/labels";
import {
  dailyMetricSeries,
  metricValue,
  METRIC_DEFINITIONS,
  percentChange,
  snapshot,
  type DailyPoint,
} from "@/domain/metrics";
import { rangeLength } from "@/domain/periods";
import type { MetricKey } from "@/domain/types";
import { cn } from "@/lib/cn";
import type { CampaignRow, ClientPeriodSummary } from "@/features/analytics/queries";
import { rankCampaignMovers } from "@/features/analytics/queries";
import type { Workspace } from "@/features/workspace/server";
import { PerformanceChart } from "./performance-chart";
import type { ChartSeries } from "./chart-geometry";

function valueFor(key: MetricKey, value: number | null, workspace: Workspace) {
  const { client } = workspace;
  return formatMetric(key, value, client.currency, {
    compact: key === "spend" || key === "revenue",
  });
}

function chartSeries(
  summary: ClientPeriodSummary,
  workspace: Workspace,
  keys: MetricKey[],
  contextTrend: DailyPoint[],
) {
  const split = summary.trend.findIndex(
    (point) => point.date >= workspace.periods.current.start,
  );
  const previous = split > 0 ? summary.trend.slice(0, split) : [];
  const current = contextTrend.length
    ? contextTrend
    : split >= 0
      ? summary.trend.slice(split)
      : summary.trend;
  return Object.fromEntries(
    keys.map((key) => [
      key,
      {
        current: current.map((point) => ({
          date: point.date,
          value: metricValue(snapshot([point]), key),
        })),
        previous: previous.map((point) => ({
          date: point.date,
          value: metricValue(snapshot([point]), key),
        })),
      },
    ]),
  ) as Partial<Record<MetricKey, ChartSeries>>;
}

function leadKey(workspace: Workspace): MetricKey {
  if (workspace.client.targetRoas !== null) return "roas";
  if (workspace.client.targetCpa !== null && workspace.client.targetCpa > 0) return "cpa";
  return "spend";
}

function targetFor(key: MetricKey, workspace: Workspace) {
  if (key === "roas") return workspace.client.targetRoas;
  if (key === "cpa") return workspace.client.targetCpa;
  return null;
}

function SupportMetric({
  reading,
  workspace,
  note,
  label,
  compact = false,
}: {
  reading: {
    key: MetricKey;
    current: number | null;
    change: number | null;
    series: (number | null)[];
  };
  workspace: Workspace;
  note: string;
  label: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 border-b border-border py-4",
        compact && "col-span-2 flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b-0",
      )}
    >
      <p className="text-sm font-medium text-ink-secondary">{label}</p>
      <div className={cn("mt-1 flex items-center justify-between gap-3", compact && "mt-0")}>
        <p
          className={cn(
            "font-semibold tracking-[-0.03em] text-ink tabular",
            compact ? "text-xl" : "text-[28px] leading-8",
          )}
        >
          {valueFor(reading.key, reading.current, workspace)}
        </p>
        {!compact && reading.series.filter((v) => v !== null).length >= 3 && (
          <Sparkline
            values={reading.series}
            width={64}
            height={20}
            className="hidden sm:block"
          />
        )}
      </div>
      <p className={cn("text-xs text-ink-muted tabular", !compact && "mt-1.5")}>
        <Delta
          change={reading.change}
          higherIsBetter={METRIC_DEFINITIONS[reading.key].higherIsBetter}
          neutralBelow={0.03}
        />{" "}
        {note && <span className="ml-1.5">{note}</span>}
      </p>
    </div>
  );
}

function LeadMetric({
  workspace,
  summary,
}: {
  workspace: Workspace;
  summary: ClientPeriodSummary;
}) {
  const key = leadKey(workspace);
  const current = metricValue(summary.comparison.current, key);
  const previous = metricValue(summary.comparison.previous, key);
  const change = percentChange(current, previous);
  const target = targetFor(key, workspace);
  const lowerIsBetter = key === "cpa";
  const meetsTarget =
    target === null || current === null
      ? null
      : lowerIsBetter
        ? current <= target
        : current >= target;
  const gap =
    target === null || current === null
      ? null
      : lowerIsBetter
        ? target - current
        : current - target;
  const progress =
    target && current !== null
      ? Math.max(
          0,
          Math.min(
            100,
            lowerIsBetter
              ? (target / Math.max(current, target * 0.35)) * 80
              : (current / (target * 1.25)) * 100,
          ),
        )
      : 0;
  const label =
    key === "cpa"
      ? conversionVocabulary(workspace.client.type).costLabel
      : METRIC_DEFINITIONS[key].label;

  return (
    <section aria-labelledby="lead-performance-title" className="min-w-0 pt-1">
      <p id="lead-performance-title" className="text-[14px] font-medium text-ink-secondary">
        {label}
      </p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-[clamp(3.5rem,7vw,5.5rem)] leading-none font-semibold tracking-[-0.045em] text-ink tabular">
          {valueFor(key, current, workspace)}
        </span>
        <Delta
          change={change}
          higherIsBetter={METRIC_DEFINITIONS[key].higherIsBetter}
          className="text-lg"
        />
      </div>
      <p className="mt-3 text-[14px] text-ink-muted">
        from{" "}
        <span className="font-medium text-ink tabular">
          {valueFor(key, previous, workspace)}
        </span>{" "}
        {rangeLength(workspace.periods.previous) === 1
          ? "the day before"
          : `in the previous ${rangeLength(workspace.periods.previous)} days`}
      </p>
      {target !== null ? (
        <div className="mt-8 max-w-[420px]">
          <div className="relative h-1.5 rounded-full bg-surface-active">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
            <span
              aria-hidden
              className="absolute -top-1.5 h-4.5 w-0.5 rounded-full bg-ink"
              style={{ left: "80%" }}
            />
          </div>
          <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
            <span
              className={cn(
                "font-medium tabular",
                meetsTarget === null
                  ? "text-ink-muted"
                  : meetsTarget
                    ? "text-positive"
                    : "text-negative",
              )}
            >
              {meetsTarget === null ? null : meetsTarget ? (
                <Check aria-hidden size={13} className="mr-1 inline" />
              ) : (
                <CircleAlert aria-hidden size={13} className="mr-1 inline" />
              )}
              {meetsTarget === null
                ? "Not enough data"
                : meetsTarget
                  ? "Meeting target"
                  : `${valueFor(key, gap === null ? 0 : Math.abs(gap), workspace)} ${lowerIsBetter ? "over" : "short of"} target`}
            </span>
            <span className="text-ink-muted">
              Target{" "}
              <span className="font-semibold text-ink tabular">
                {valueFor(key, target, workspace)}
              </span>
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ContextRail({
  workspace,
  summary,
  rows,
}: {
  workspace: Workspace;
  summary: ClientPeriodSummary;
  rows: CampaignRow[];
}) {
  const key = leadKey(workspace);
  const current = metricValue(summary.comparison.current, key);
  const target = targetFor(key, workspace);
  const meets =
    target === null || current === null
      ? null
      : key === "cpa"
        ? current <= target
        : current >= target;
  const delivering = rows
    .filter((row) => row.current.totals.spend > 0)
    .sort((a, b) => b.current.totals.spend - a.current.totals.spend);
  const totalSpend = delivering.reduce((sum, row) => sum + row.current.totals.spend, 0);
  const topSpend = delivering
    .slice(0, 3)
    .reduce((sum, row) => sum + row.current.totals.spend, 0);
  const movers = rankCampaignMovers(
    rows,
    conversionVocabulary(workspace.client.type).plural,
  ).slice(0, 3);

  return (
    <aside
      aria-label="Contextual analysis"
      className="grid min-w-0 gap-6 border-t border-border pt-6 min-[1400px]:block min-[1400px]:border-t-0 min-[1400px]:border-l min-[1400px]:pt-0 min-[1400px]:pl-6 md:grid-cols-3"
    >
      <section className="min-w-0 min-[1400px]:border-b min-[1400px]:border-border min-[1400px]:pb-5">
        <p className="text-xs font-medium text-ink-muted">Target status</p>
        <p
          className={cn(
            "mt-2 text-2xl font-semibold tracking-[-0.02em]",
            meets === false ? "text-negative" : meets ? "text-positive" : "text-ink",
          )}
        >
          {target === null
            ? "No target"
            : current === null
              ? "No reading"
              : meets
                ? "On target"
                : "Needs attention"}
        </p>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          {target === null
            ? "Add a target to make this comparison explicit."
            : `${key === "cpa" ? conversionVocabulary(workspace.client.type).costLabel : METRIC_DEFINITIONS[key].label} against ${valueFor(key, target, workspace)} target`}
        </p>
      </section>
      <section className="min-w-0 min-[1400px]:border-b min-[1400px]:border-border min-[1400px]:py-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-ink-muted">Spend concentration</p>
          <Layers3 aria-hidden size={15} className="text-ink-faint" />
        </div>
        <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-ink tabular">
          {formatPercent(totalSpend ? topSpend / totalSpend : 0, 0)}
        </p>
        <p className="mt-1 text-xs leading-5 text-ink-muted">
          in the top {Math.min(3, delivering.length)} campaigns
        </p>
        <div className="mt-3 h-1.5 rounded-full bg-accent-soft">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${totalSpend ? (topSpend / totalSpend) * 100 : 0}%` }}
          />
        </div>
      </section>
      <section className="min-w-0 min-[1400px]:pt-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-medium text-ink-muted">Largest changes</p>
          <span className="text-2xs text-ink-faint">vs prior</span>
        </div>
        <ul className="mt-2 divide-y divide-border">
          {movers.map((mover) => (
            <li key={`${mover.campaign.id}-${mover.metric}`} className="py-2.5">
              <p
                title={mover.campaign.name}
                className="line-clamp-2 text-sm leading-5 font-medium text-ink"
              >
                {mover.campaign.name}
              </p>
              <p className="mt-1 flex items-baseline justify-between gap-3 text-xs text-ink-muted">
                <span>{mover.label}</span>
                <Delta change={mover.change} higherIsBetter={mover.higherIsBetter} />
              </p>
            </li>
          ))}
          {!movers.length && (
            <li className="py-3 text-xs text-ink-muted">No material changes in this period.</li>
          )}
        </ul>
      </section>
    </aside>
  );
}

function TopCampaigns({ workspace, rows }: { workspace: Workspace; rows: CampaignRow[] }) {
  const delivering = rows
    .filter((row) => row.current.totals.spend > 0)
    .sort((a, b) => b.current.totals.spend - a.current.totals.spend)
    .slice(0, 6);
  const maxSpend = delivering[0]?.current.totals.spend ?? 1;
  return (
    <section className="min-w-0 border-t border-border pt-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
            Top campaigns
          </h2>
          <p className="mt-1 text-xs text-ink-muted">Ranked by spend in this period</p>
        </div>
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1 text-xs font-medium text-accent transition-colors hover:text-accent-strong"
        >
          View all <ArrowUpRight aria-hidden size={13} />
        </Link>
      </div>
      <ol className="mt-4 divide-y divide-border">
        {delivering.map((row, index) => (
          <li key={row.campaign.id} className="flex items-center gap-3 py-3">
            <span className="w-5 shrink-0 text-xs text-ink-faint tabular">
              {String(index + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">{row.campaign.name}</p>
              <div className="mt-1.5 h-1 rounded-full bg-surface-active">
                <div
                  className="h-full rounded-full bg-ink-secondary"
                  style={{ width: `${(row.current.totals.spend / maxSpend) * 100}%` }}
                />
              </div>
            </div>
            <div className="w-24 shrink-0 text-right">
              <p className="text-[14px] font-semibold text-ink tabular">
                {formatCurrency(row.current.totals.spend, workspace.client.currency)}
              </p>
              <p className="mt-0.5 text-xs text-ink-muted tabular">
                {tracksRevenue(workspace.client)
                  ? `${formatMetric("roas", row.current.derived.roas, workspace.client.currency)} ROAS`
                  : `${formatMetric("cpa", row.current.derived.cpa, workspace.client.currency)} CPA`}
              </p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function WhatChanged({ workspace, rows }: { workspace: Workspace; rows: CampaignRow[] }) {
  const movers = rankCampaignMovers(
    rows,
    conversionVocabulary(workspace.client.type).plural,
  ).slice(0, 6);
  return (
    <section className="min-w-0 border-t border-border pt-6">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
            What changed
          </h2>
          <p className="mt-1 text-xs text-ink-muted">Largest campaign-level movements</p>
        </div>
        <span className="text-xs text-ink-muted">{workspace.comparison}</span>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {movers.map((mover) => (
          <li
            key={`${mover.campaign.id}-${mover.metric}`}
            className="flex items-center gap-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">{mover.campaign.name}</p>
              <p className="mt-0.5 text-xs text-ink-muted">{mover.label}</p>
            </div>
            <Delta
              change={mover.change}
              higherIsBetter={mover.higherIsBetter}
              className="text-base"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function OverviewAnalytics({
  workspace,
  summary,
  campaignRows,
  contextTrend,
}: {
  workspace: Workspace;
  summary: ClientPeriodSummary;
  campaignRows: CampaignRow[];
  contextTrend: DailyPoint[];
}) {
  const lead = leadKey(workspace);
  const keys = [
    ...new Set<MetricKey>([
      lead,
      "spend",
      ...(tracksRevenue(workspace.client) ? ["revenue" as const] : []),
      "conversions",
      "cpa",
      "ctr",
    ]),
  ];
  const chart = chartSeries(summary, workspace, keys, contextTrend);
  const readings = keys
    .filter((key) => key !== lead)
    .slice(0, 5)
    .map((key) => getReading(summary, key, workspace.periods.current.start));
  const current = summary.comparison.current;
  const vocabulary = conversionVocabulary(workspace.client.type);

  return (
    <div className="flex flex-col">
      <section className="grid gap-8 xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1fr)] xl:gap-12">
        <LeadMetric workspace={workspace} summary={summary} />
        <div
          aria-label="Supporting metrics"
          className="grid min-w-0 grid-cols-2 gap-x-6 sm:gap-x-8"
        >
          {readings.map((reading) => (
            <SupportMetric
              key={reading.key}
              reading={reading}
              workspace={workspace}
              compact={reading.key === "ctr"}
              note={
                reading.key === "cpa" && workspace.client.targetCpa !== null
                  ? `Target ${valueFor("cpa", workspace.client.targetCpa, workspace)}`
                  : reading.key === "ctr"
                    ? "vs prior"
                    : `vs ${valueFor(reading.key, reading.previous, workspace)}`
              }
              label={
                reading.key === "cpa"
                  ? vocabulary.costLabel
                  : reading.key === "conversions"
                    ? vocabulary.plural
                    : METRIC_DEFINITIONS[reading.key].label
              }
            />
          ))}
        </div>
      </section>
      <div className="mt-10 grid min-w-0 gap-8 min-[1400px]:grid-cols-[minmax(0,1fr)_248px]">
        <PerformanceChart
          key={`${workspace.client.id}-${workspace.preset}`}
          series={chart}
          metricKeys={keys}
          selectedKey={lead}
          currency={workspace.client.currency}
          targets={{ roas: workspace.client.targetRoas, cpa: workspace.client.targetCpa }}
          comparison={workspace.comparison}
          totals={Object.fromEntries(keys.map((key) => [key, metricValue(current, key)]))}
          labels={{
            conversions: vocabulary.plural,
            revenue: "Revenue",
            cpa: vocabulary.costLabel,
          }}
          singleDay={rangeLength(workspace.periods.current) === 1}
        />
        <ContextRail workspace={workspace} summary={summary} rows={campaignRows} />
      </div>
      <div className="mt-12 grid gap-10 lg:grid-cols-2">
        <TopCampaigns workspace={workspace} rows={campaignRows} />
        <WhatChanged workspace={workspace} rows={campaignRows} />
      </div>
    </div>
  );
}

function getReading(summary: ClientPeriodSummary, key: MetricKey, start: string) {
  const current = metricValue(summary.comparison.current, key);
  const previous = metricValue(summary.comparison.previous, key);
  return {
    key,
    current,
    previous,
    change: percentChange(current, previous),
    series: dailyMetricSeries(
      summary.trend.filter((p) => p.date >= start),
      key,
    ),
  };
}

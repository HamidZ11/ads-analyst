import { Delta } from "@/components/ui/delta";
import { formatChange, formatCurrency, formatMultiple, formatNumber } from "@/domain/format";
import { conversionVocabulary, tracksRevenue } from "@/domain/labels";
import { metricChange, metricValue } from "@/domain/metrics";
import type { CampaignRow, ClientPeriodSummary } from "@/features/analytics/queries";
import { rankCampaignMovers } from "@/features/analytics/queries";
import type { Workspace } from "@/features/workspace/server";

interface Line {
  id: string;
  title: string;
  body: React.ReactNode;
}

function shortName(row: CampaignRow): string {
  // "Prospecting | Broad | Retinol Renewal Serum" → "Retinol Renewal Serum"
  const parts = row.campaign.name.split("|").map((p) => p.trim());
  return parts[parts.length - 1] || row.campaign.name;
}

/**
 * Factual period summary computed from the same numbers the band and chart
 * use. Statements, not findings: no thresholds, no recommendations.
 */
export function PeriodSummary({
  workspace,
  summary,
  campaignRows,
}: {
  workspace: Workspace;
  summary: ClientPeriodSummary;
  campaignRows: CampaignRow[];
}) {
  const { client, comparison } = workspace;
  const vocab = conversionVocabulary(client.type);
  const { current } = summary.comparison;
  const movers = rankCampaignMovers(campaignRows);

  const cpa = metricValue(current, "cpa");
  const roas = metricValue(current, "roas");
  const lines: Line[] = [];

  lines.push({
    id: "spend",
    title: "Spend",
    body: (
      <>
        {formatCurrency(current.totals.spend, client.currency)} across{" "}
        {campaignRows.filter((r) => r.current.totals.spend > 0).length} campaigns,{" "}
        <Delta change={metricChange(summary.comparison, "spend")} higherIsBetter={null} /> vs{" "}
        {comparison}.
      </>
    ),
  });

  lines.push({
    id: "conversions",
    title: vocab.plural,
    body: (
      <>
        {formatNumber(current.totals.conversions)} {vocab.plural.toLowerCase()} at{" "}
        {formatCurrency(cpa, client.currency, { decimals: 2 })} each,{" "}
        <Delta change={metricChange(summary.comparison, "conversions")} higherIsBetter={true} />{" "}
        in volume and{" "}
        <Delta change={metricChange(summary.comparison, "cpa")} higherIsBetter={false} /> in
        cost.
      </>
    ),
  });

  if (cpa !== null) {
    const gap = (cpa - client.targetCpa) / client.targetCpa;
    lines.push({
      id: "target-cpa",
      title: "Against target",
      body: (
        <>
          {vocab.costLabel} is {formatChange(Math.abs(gap)).replace("+", "")}{" "}
          {gap <= 0 ? "under" : "over"} the {formatCurrency(client.targetCpa, client.currency)}{" "}
          target
          {tracksRevenue(client) && client.targetRoas !== null && roas !== null ? (
            <>
              ; ROAS {formatMultiple(roas)} is{" "}
              {formatChange(Math.abs((roas - client.targetRoas) / client.targetRoas)).replace(
                "+",
                "",
              )}{" "}
              {roas >= client.targetRoas ? "above" : "below"}{" "}
              {formatMultiple(client.targetRoas, 1)}.
            </>
          ) : (
            "."
          )}
        </>
      ),
    });
  }

  if (movers.spendIncrease) {
    const r = movers.spendIncrease;
    lines.push({
      id: "spend-mover",
      title: "Largest spend increase",
      body: (
        <>
          {shortName(r)}: <Delta change={r.spendChange} higherIsBetter={null} /> spend,{" "}
          <Delta change={r.conversionsChange} higherIsBetter={true} />{" "}
          {vocab.plural.toLowerCase()}.
        </>
      ),
    });
  }

  if (movers.conversionDecline) {
    const r = movers.conversionDecline;
    lines.push({
      id: "conversion-mover",
      title: `Largest ${vocab.singular.toLowerCase()} decline`,
      body: (
        <>
          {shortName(r)}: <Delta change={r.conversionsChange} higherIsBetter={true} />{" "}
          {vocab.plural.toLowerCase()} on <Delta change={r.spendChange} higherIsBetter={null} />{" "}
          spend.
        </>
      ),
    });
  }

  if (movers.mostEfficient) {
    const r = movers.mostEfficient;
    lines.push({
      id: "efficient",
      title: `Lowest ${vocab.costLabel.toLowerCase()}`,
      body: (
        <>
          {shortName(r)} at{" "}
          {formatCurrency(r.current.derived.cpa, client.currency, { decimals: 2 })} on{" "}
          {formatCurrency(r.current.totals.spend, client.currency)} spend.
        </>
      ),
    });
  }

  return (
    <aside aria-labelledby="summary-heading" className="rounded-lg bg-surface-subtle px-5 py-5">
      <h2 id="summary-heading" className="text-sm font-semibold text-ink">
        Period summary
      </h2>
      <p className="mt-0.5 text-xs text-ink-muted">
        Computed from daily metrics. Findings arrive with the insight engine.
      </p>
      <dl className="mt-4 flex flex-col divide-y divide-border/70">
        {lines.map((line) => (
          <div key={line.id} className="py-3 first:pt-0 last:pb-0">
            <dt className="text-xs font-medium text-ink-muted">{line.title}</dt>
            <dd className="mt-1 text-sm leading-5 text-ink-secondary">{line.body}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

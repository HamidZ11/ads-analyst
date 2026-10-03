import { conversionVocabulary, tracksRevenue } from "@/domain/labels";
import { dailySeries, deriveMetrics, sumMetrics } from "@/domain/metrics";
import {
  getCampaignRows,
  rankCampaignMovers,
  type CampaignMover,
  type CampaignRow,
} from "@/features/analytics/queries";
import { luxeWorkspace } from "../sidebar-lab/workspace";

export interface LabCampaign {
  row: CampaignRow;
  /** Daily spend and conversions inside the selected period, for inline trends. */
  spendSeries: number[];
  conversionSeries: number[];
  /** Cost per conversion above the client's target; null without a reading. */
  overTarget: boolean | null;
}

/**
 * One read model for all three concepts: the production campaign rows for the
 * fixed Luxe Skin Co. workspace, plus facts every concept may show (daily
 * series, target position, account totals, ranked movers). Nothing here is a
 * classification; every value is derived directly from the metrics.
 */
export function buildCampaignsLab() {
  const workspace = luxeWorkspace();
  const { repository, client, periods, comparison } = workspace;
  const rows = getCampaignRows(repository, client, periods).sort(
    (a, b) => b.current.totals.spend - a.current.totals.spend,
  );
  const campaigns: LabCampaign[] = rows.map((row) => {
    const adSets = repository.listAdSets(row.campaign.id);
    const ads = adSets.flatMap((s) => repository.listAds(s.id));
    const daily = dailySeries(
      repository.queryMetrics({
        clientId: client.id,
        entityIds: ads.map((a) => a.id),
        range: periods.current,
      }),
      periods.current,
    );
    const cpa = row.current.derived.cpa;
    return {
      row,
      spendSeries: daily.map((p) => p.spend),
      conversionSeries: daily.map((p) => p.conversions),
      overTarget:
        cpa === null || client.targetCpa === null || client.targetCpa <= 0
          ? null
          : cpa > client.targetCpa,
    };
  });
  const totals = sumMetrics(rows.map((r) => r.current.totals));
  const previousTotals = sumMetrics(rows.map((r) => r.previous.totals));
  const vocabulary = conversionVocabulary(client.type);
  const delivering = rows.filter((r) => r.current.totals.spend > 0);
  return {
    workspace,
    client,
    comparison,
    rows,
    campaigns,
    totals,
    derived: deriveMetrics(totals),
    previousTotals,
    previousDerived: deriveMetrics(previousTotals),
    vocabulary,
    showRoas: tracksRevenue(client),
    movers: rankCampaignMovers(rows, vocabulary.plural) as CampaignMover[],
    counts: {
      all: rows.length,
      active: rows.filter((r) => r.campaign.status === "active").length,
      paused: rows.filter((r) => r.campaign.status === "paused").length,
      delivering: delivering.length,
      overTarget: campaigns.filter((c) => c.overTarget === true).length,
    },
  };
}

export type CampaignsLab = ReturnType<typeof buildCampaignsLab>;

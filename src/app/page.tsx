import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import {
  getCampaignRows,
  getClientPeriodSummary,
  getTrailingSeries,
} from "@/features/analytics/queries";
import { OverviewAnalytics } from "@/features/overview/overview-analytics";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const workspace = await getWorkspace();
  const { repository, client, adAccount, periods, comparison } = workspace;
  const summary = getClientPeriodSummary(repository, client, periods);
  const campaignRows = getCampaignRows(repository, client, periods);
  const contextTrend =
    periods.current.start === periods.current.end
      ? getTrailingSeries(repository, client, periods.current.end, 14)
      : [];

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${client.name} · Meta Ads${adAccount?.externalId ? ` · ${adAccount.externalId}` : ""}`}
        actions={
          <>
            <span className="text-xs text-ink-muted md:text-right">
              <span className="block font-medium text-ink-secondary">
                {formatDateRange(periods.current)}
              </span>
              <span className="mt-0.5 block">vs {comparison}</span>
            </span>
            <DatePresetControl value={workspace.preset} />
          </>
        }
      />
      <OverviewAnalytics
        workspace={workspace}
        summary={summary}
        campaignRows={campaignRows}
        contextTrend={contextTrend}
      />
    </>
  );
}

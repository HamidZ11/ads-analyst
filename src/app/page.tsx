import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import {
  getAccountStructure,
  getCampaignRows,
  getClientPeriodSummary,
  getTrailingSeries,
} from "@/features/analytics/queries";
import { AccountStructure } from "@/features/overview/account-structure";
import { OverviewKpis } from "@/features/overview/overview-kpis";
import { SpendByCampaign } from "@/features/overview/spend-by-campaign";
import { TrendFrame } from "@/features/overview/trend-frame";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const workspace = await getWorkspace();
  const { repository, client, adAccount, periods, comparison, today } = workspace;
  const summary = getClientPeriodSummary(repository, client, periods);
  const trend = getTrailingSeries(repository, client, today, 30);
  const campaignRows = getCampaignRows(repository, client, periods);
  const structure = getAccountStructure(repository, client);

  return (
    <>
      <PageHeader
        title="Overview"
        description={`${client.name} · Meta Ads${adAccount ? ` · ${adAccount.externalId}` : ""}`}
        actions={
          <>
            <span className="text-xs text-ink-muted">
              {formatDateRange(periods.current)}{" "}
              <span className="text-ink-faint">vs {comparison}</span>
            </span>
            <DatePresetControl value={workspace.preset} />
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <OverviewKpis workspace={workspace} summary={summary} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            <TrendFrame workspace={workspace} series={trend} />
          </div>
          <div className="flex flex-col gap-4">
            <SpendByCampaign workspace={workspace} rows={campaignRows} />
            <AccountStructure workspace={workspace} structure={structure} />
          </div>
        </div>
      </div>
    </>
  );
}

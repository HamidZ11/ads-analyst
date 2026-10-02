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
import { AccountStrip } from "@/features/overview/account-strip";
import { KpiBand } from "@/features/overview/kpi-band";
import { PerformanceChart } from "@/features/overview/performance-chart";
import { PeriodSummary } from "@/features/overview/period-summary";
import { SpendByCampaign } from "@/features/overview/spend-by-campaign";
import { TopCampaigns } from "@/features/overview/top-campaigns";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Overview" };

export default async function OverviewPage() {
  const workspace = await getWorkspace();
  const { repository, client, periods, comparison, today } = workspace;
  const summary = getClientPeriodSummary(repository, client, periods);
  const trend = getTrailingSeries(repository, client, today, 30);
  const campaignRows = getCampaignRows(repository, client, periods);
  const structure = getAccountStructure(repository, client);

  return (
    <>
      <PageHeader
        eyebrow={client.name}
        title="Overview"
        description={
          <>
            {formatDateRange(periods.current)}{" "}
            <span className="text-ink-faint">compared with the {comparison}</span>
          </>
        }
        actions={<DatePresetControl value={workspace.preset} />}
      />

      <KpiBand workspace={workspace} summary={summary} chartedKey="spend" />

      <div className="mt-10 grid gap-10 xl:grid-cols-[minmax(0,1fr)_300px]">
        <PerformanceChart workspace={workspace} series={trend} />
        <PeriodSummary workspace={workspace} summary={summary} campaignRows={campaignRows} />
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <SpendByCampaign workspace={workspace} rows={campaignRows} />
        <TopCampaigns workspace={workspace} rows={campaignRows} />
      </div>

      <div className="mt-12">
        <AccountStrip workspace={workspace} structure={structure} />
      </div>
    </>
  );
}

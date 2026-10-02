import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { Card } from "@/components/ui/card";
import { Note } from "@/components/ui/note";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import { conversionVocabulary, tracksRevenue } from "@/domain/labels";
import { getCampaignRows } from "@/features/analytics/queries";
import { CampaignsTable } from "@/features/campaigns/campaigns-table";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const workspace = await getWorkspace();
  const { repository, client, periods, comparison } = workspace;
  const rows = getCampaignRows(repository, client, periods);

  return (
    <>
      <PageHeader
        title="Campaigns"
        description={`${client.name} · ${rows.length} campaigns`}
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
      <Card className="overflow-hidden">
        <CampaignsTable
          rows={rows}
          currency={client.currency}
          vocabulary={conversionVocabulary(client.type)}
          comparison={comparison}
          showRoas={tracksRevenue(client)}
        />
      </Card>
      <Note className="mt-3">
        Ad set and ad drilldown, saved filters and column controls arrive with the campaign
        analysis release.
      </Note>
    </>
  );
}

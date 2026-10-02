import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
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
        eyebrow={client.name}
        title="Campaigns"
        description={
          <>
            {formatDateRange(periods.current)}{" "}
            <span className="text-ink-faint">compared with the {comparison}</span>
          </>
        }
        actions={<DatePresetControl value={workspace.preset} />}
      />
      <CampaignsTable
        rows={rows}
        currency={client.currency}
        vocabulary={conversionVocabulary(client.type)}
        comparison={comparison}
        showRoas={tracksRevenue(client)}
      />
      <Note className="mt-4">
        Ad set and ad drilldown, saved filters and column controls arrive with the campaign
        analysis release.
      </Note>
    </>
  );
}

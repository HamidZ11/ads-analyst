import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import { conversionVocabulary, tracksRevenue } from "@/domain/labels";
import { getCampaignRows } from "@/features/analytics/queries";
import { CampaignsSummary } from "@/features/campaigns/campaigns-summary";
import { CampaignsTable } from "@/features/campaigns/campaigns-table";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Campaigns" };

export default async function CampaignsPage() {
  const workspace = await getWorkspace();
  const { repository, client, periods, comparison } = workspace;
  const rows = getCampaignRows(repository, client, periods);
  const delivering = rows.filter((r) => r.current.totals.spend > 0).length;
  const vocabulary = conversionVocabulary(client.type);

  return (
    <>
      <PageHeader
        title="Campaigns"
        description={`${client.name} · ${rows.length} campaigns · ${delivering} delivering`}
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
      <CampaignsSummary
        rows={rows}
        client={client}
        vocabulary={vocabulary}
        comparison={comparison}
      />
      <CampaignsTable
        rows={rows}
        currency={client.currency}
        vocabulary={vocabulary}
        comparison={comparison}
        showRoas={tracksRevenue(client)}
        targetCpa={client.targetCpa}
      />
      <p className="mt-3 text-xs text-ink-muted">
        Changes compare with the {comparison}. Movements under 5% stay grey.
      </p>
    </>
  );
}

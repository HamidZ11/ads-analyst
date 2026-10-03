import { DatePresetControl } from "@/components/shell/date-preset-control";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import { CampaignsSummary } from "@/features/campaigns/campaigns-summary";
import { CampaignsTable } from "@/features/campaigns/campaigns-table";
import { buildCreativeBoard } from "@/features/creatives/board-data";
import { CreativeBoard } from "@/features/creatives/creative-board";
import { conversionVocabulary } from "@/domain/labels";
import { OverviewAnalytics } from "@/features/overview/overview-analytics";
import { campaignsTableProps, type LandingEvidence } from "./evidence";
import styles from "./product-canvases.module.css";

/* Server-rendered product surfaces for marketing showcases: the shipped
   components, fed the pinned seeded workspace, laid out as inside the app.
   Read-only by construction: each is shown inside an inert ProductCrop. */

export function OverviewCanvas({
  evidence,
  header = true,
}: {
  evidence: LandingEvidence;
  header?: boolean;
}) {
  const { workspace, summary, campaignRows } = evidence;
  const { client, adAccount, periods, comparison } = workspace;
  return (
    <div className="px-8 pt-7 pb-8">
      {header ? (
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
      ) : null}
      <OverviewAnalytics
        workspace={workspace}
        summary={summary}
        campaignRows={campaignRows}
        contextTrend={[]}
      />
    </div>
  );
}

export function CampaignsCanvas({ evidence }: { evidence: LandingEvidence }) {
  return (
    <div className={`p-6 ${styles.ledgerPin}`}>
      <CampaignsTable {...campaignsTableProps(evidence)} />
    </div>
  );
}

/** The Campaigns page body: the summary strip above the ledger, as shipped. */
export function CampaignsPageCanvas({ evidence }: { evidence: LandingEvidence }) {
  const { client, comparison } = evidence.workspace;
  return (
    <div className={`p-6 ${styles.ledgerPin}`}>
      <CampaignsSummary
        rows={evidence.campaignRows}
        client={client}
        vocabulary={conversionVocabulary(client.type)}
        comparison={comparison}
      />
      <CampaignsTable {...campaignsTableProps(evidence)} />
    </div>
  );
}

/** The Creatives board, as shipped. */
export function CreativesCanvas({ evidence }: { evidence: LandingEvidence }) {
  return (
    <div className="p-6">
      <CreativeBoard model={buildCreativeBoard(evidence.workspace)} />
    </div>
  );
}

import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { Note } from "@/components/ui/note";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import { conversionVocabulary, tracksRevenue } from "@/domain/labels";
import { rangeLength } from "@/domain/periods";
import { getCreativeRows } from "@/features/analytics/queries";
import { CreativeGrid } from "@/features/creatives/creative-grid";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Creatives" };

export default async function CreativesPage() {
  const workspace = await getWorkspace();
  const { repository, client, periods, comparison } = workspace;
  const rows = getCreativeRows(repository, client, periods);
  const periodDays = rangeLength(periods.current);

  return (
    <>
      <PageHeader
        eyebrow={client.name}
        title="Creatives"
        description={
          <>
            {rows.length} creatives across{" "}
            {new Set(rows.flatMap((r) => r.campaigns.map((c) => c.id))).size} campaigns ·{" "}
            {formatDateRange(periods.current)}{" "}
            <span className="text-ink-faint">compared with the {comparison}</span>
          </>
        }
        actions={<DatePresetControl value={workspace.preset} />}
      />
      <CreativeGrid
        rows={rows}
        currency={client.currency}
        vocabulary={conversionVocabulary(client.type)}
        comparison={comparison}
        showRoas={tracksRevenue(client)}
        splitIndex={rangeLength(periods.previous)}
        periodDays={periodDays}
      />
      <Note className="mt-4">
        Fatigue and winner signals, creative-level trends and imported imagery arrive with the
        creative analysis release.
      </Note>
    </>
  );
}

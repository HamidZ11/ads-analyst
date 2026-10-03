import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import { buildCreativeBoard } from "@/features/creatives/board-data";
import { CreativeBoard } from "@/features/creatives/creative-board";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Creatives" };

export default async function CreativesPage() {
  const workspace = await getWorkspace();
  const { client, periods, comparison } = workspace;
  const model = buildCreativeBoard(workspace);

  return (
    <>
      <PageHeader
        title="Creatives"
        description={`${client.name} · ${model.items.length} creatives across ${model.campaignCount} campaigns`}
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
      <CreativeBoard key={`${client.id}-${workspace.preset}`} model={model} />
    </>
  );
}

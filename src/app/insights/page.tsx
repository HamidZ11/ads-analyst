import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import { buildInsightsModel } from "@/features/insights/insights-model";
import { InsightsWorkspace } from "@/features/insights/insights-workspace";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage() {
  const workspace = await getWorkspace();
  const { client, periods, comparison } = workspace;
  const model = buildInsightsModel(workspace);
  const count = model.findings.length;

  return (
    <>
      <PageHeader
        title="Insights"
        description={`${client.name} · ${count} ${count === 1 ? "finding" : "findings"} across ${model.campaignCount} campaigns and ${model.creativeCount} creatives`}
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
      <InsightsWorkspace key={`${client.id}-${workspace.preset}`} model={model} />
    </>
  );
}

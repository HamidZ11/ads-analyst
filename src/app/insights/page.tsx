import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { PageHeader } from "@/components/ui/page-header";
import { formatDateRange } from "@/domain/format";
import { buildInsightsModel } from "@/features/insights/insights-model";
import { InsightsWorkspace } from "@/features/insights/insights-workspace";
import { EmptyWorkspace } from "@/features/onboarding/empty-workspace";
import { ImportedNote } from "@/features/onboarding/imported-note";
import { workspaceProgress } from "@/features/onboarding/progress";
import { getWorkspaceContext, readyWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await getWorkspaceContext();
  const workspace = readyWorkspace(context);
  if (!workspace)
    return (
      <EmptyWorkspace
        page="insights"
        workspaceName={context.workspace.name}
        progress={workspaceProgress(context)}
      />
    );
  const { client, dataSource, periods, comparison } = workspace;
  const model = buildInsightsModel(workspace);
  const count = model.findings.length;
  // Set by the first import's redirect; only an imported client has an import to name.
  const justImported = (await searchParams).imported === "1" && dataSource.kind === "meta_csv";

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
      {justImported ? (
        <ImportedNote
          client={client}
          dataSource={dataSource}
          progress={workspaceProgress(context)}
        />
      ) : null}
      <InsightsWorkspace key={`${client.id}-${workspace.preset}`} model={model} />
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { AskAnalyst } from "@/features/ask/ask-analyst";
import { askScope } from "@/features/ask/facts";
import { EmptyWorkspace } from "@/features/onboarding/empty-workspace";
import { workspaceProgress } from "@/features/onboarding/progress";
import { getWorkspaceContext, readyWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Ask Analyst" };

export default async function AskAnalystPage() {
  const context = await getWorkspaceContext();
  const workspace = readyWorkspace(context);
  if (!workspace)
    return (
      <EmptyWorkspace
        page="ask"
        workspaceName={context.workspace.name}
        progress={workspaceProgress(context)}
      />
    );
  const scope = askScope(workspace);

  return (
    <div className="flex h-[calc(100dvh-5.5rem)] min-h-[480px] min-w-0 flex-col lg:h-[calc(100dvh-4rem)]">
      <PageHeader
        title="Ask Analyst"
        description="Follow a question into the evidence."
        actions={<DatePresetControl value={workspace.preset} />}
        className="mb-5 shrink-0"
      />
      <AskAnalyst key={scope.key} scope={scope} />
    </div>
  );
}

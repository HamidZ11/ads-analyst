import type { Metadata } from "next";
import { cookies } from "next/headers";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { Note } from "@/components/ui/note";
import { PageHeader } from "@/components/ui/page-header";
import { ClientReport } from "@/features/report/client-report";
import { PrintButton } from "@/features/report/print-button";
import { buildClientReport } from "@/features/report/report-model";
import { shareLinkView } from "@/features/report/share";
import { ShareDialog } from "@/features/report/share-dialog";
import { EmptyWorkspace } from "@/features/onboarding/empty-workspace";
import { workspaceProgress } from "@/features/onboarding/progress";
import { parseDatePreset } from "@/domain/periods";
import { selectReportDatePreset } from "@/features/workspace/actions";
import { withPreset } from "@/features/workspace/context";
import { REPORT_RANGE_COOKIE } from "@/features/workspace/cookies";
import { getWorkspaceContext, loadSession, readyWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Client report" };

export default async function ClientReportPage() {
  // The report keeps its own period, 7D unless chosen here (D-NEW-fixes-report-1).
  const preset = parseDatePreset((await cookies()).get(REPORT_RANGE_COOKIE)?.value);
  const context = withPreset(await getWorkspaceContext(), preset);
  const workspace = readyWorkspace(context);
  // An empty workspace shows what the report will hold, like every page (D-090).
  if (!workspace)
    return (
      <EmptyWorkspace
        page="report"
        workspaceName={context.workspace.name}
        progress={workspaceProgress(context)}
      />
    );
  const session = await loadSession();
  const gateway = session.kind === "app" ? session.gateway : null;
  const model = buildClientReport(workspace);
  // The note is read through RLS for this client and period only.
  const note = gateway
    ? await gateway
        .reportNote(model.clientId, model.current.start, model.current.end)
        .catch(() => null)
    : null;
  // The client's links that still open, for the share dialog (D-NEW-share-1).
  const links = gateway
    ? await gateway
        .shareLinks(context.workspace.id)
        .then((all) =>
          all
            .filter((link) => link.clientId === model.clientId)
            .map((link) => shareLinkView(link, context.clients))
            .filter((link) => link !== null),
        )
        .catch(() => [])
    : null;
  const shareUnavailable = !gateway
    ? "Share links need a signed-in workspace. In the demo, use Print or save as PDF to send the report."
    : session.kind === "app" && session.role !== "owner"
      ? "Only the workspace owner can create share links. You can still revoke the links below."
      : null;

  return (
    <>
      <PageHeader
        className="print:hidden"
        title="Client report"
        description={`${model.clientName} · a report to send, for the selected period`}
        actions={
          <>
            <span className="text-xs text-ink-muted md:text-right">
              <span className="block font-medium text-ink-secondary">{model.currentLabel}</span>
              <span className="mt-0.5 block">vs {model.comparison}</span>
            </span>
            <DatePresetControl value={workspace.preset} select={selectReportDatePreset} />
            <ShareDialog
              clientId={model.clientId}
              clientName={model.clientName}
              preset={workspace.preset}
              periodStart={model.current.start}
              periodEnd={model.current.end}
              periodLabel={model.currentLabel}
              links={links}
              unavailable={shareUnavailable}
            />
            <PrintButton />
          </>
        }
      />
      <ClientReport model={model} note={note} canSave={gateway !== null} />
      <Note className="mx-auto mt-6 max-w-[960px] print:hidden">
        In the print dialog, choose &quot;Save as PDF&quot; to get a file you can send. App
        navigation and these controls are left out of the printout.
      </Note>
    </>
  );
}

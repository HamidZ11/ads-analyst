import type { Metadata } from "next";
import { DatePresetControl } from "@/components/shell/date-preset-control";
import { Note } from "@/components/ui/note";
import { PageHeader } from "@/components/ui/page-header";
import { ClientReport } from "@/features/report/client-report";
import { PrintButton } from "@/features/report/print-button";
import { buildClientReport } from "@/features/report/report-model";
import { loadSession, getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Client report" };

export default async function ClientReportPage() {
  const workspace = await getWorkspace();
  const session = await loadSession();
  const gateway = session.kind === "app" ? session.gateway : null;
  const model = buildClientReport(workspace);
  // The note is read through RLS for this client and period only.
  const note = gateway
    ? await gateway
        .reportNote(model.clientId, model.current.start, model.current.end)
        .catch(() => null)
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
            <DatePresetControl value={workspace.preset} />
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

import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Note } from "@/components/ui/note";
import { PageHeader } from "@/components/ui/page-header";
import { ClientsTable } from "@/features/clients/clients-table";
import { EmptyWorkspace } from "@/features/onboarding/empty-workspace";
import { GettingStarted, TargetsNudge } from "@/features/onboarding/getting-started";
import { workspaceProgress } from "@/features/onboarding/progress";
import { getWorkspaceContext, readyWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const context = await getWorkspaceContext();
  const workspace = readyWorkspace(context);
  const progress = workspaceProgress(context);
  if (!workspace)
    return (
      <EmptyWorkspace
        page="clients"
        workspaceName={context.workspace.name}
        progress={progress}
      />
    );
  const { agency, clients, client, repository, mode } = workspace;
  const rows = clients.map((c) => ({
    client: c,
    coverage: repository.getCoverage(c.id),
    source: repository.getDataSource(c.id),
    accountId: repository.listAdAccounts(c.id)[0]?.externalId || null,
  }));

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${agency.name} · ${clients.length} ${clients.length === 1 ? "client" : "clients"} · selecting a client changes every page`}
        actions={
          <>
            <Link href="/clients/import?client=new" className={buttonClasses("secondary")}>
              New client
            </Link>
            <Link href="/clients/import" className={buttonClasses("primary")}>
              Import Meta CSV
            </Link>
          </>
        }
      />
      {progress && !progress.ready ? (
        <div className="mb-8">
          <GettingStarted progress={progress} />
        </div>
      ) : null}
      {progress ? <TargetsNudge progress={progress} className="-mt-4 mb-4" /> : null}
      <Card className="overflow-hidden">
        <ClientsTable rows={rows} selectedId={client.id} />
      </Card>
      <Note className="mt-3">
        {mode === "demo"
          ? "Demo clients are seeded and read-only. Connect a database to import your own Meta Ads exports."
          : "A new client is created from its first Meta Ads CSV export; later imports refresh the days they contain."}
      </Note>
    </>
  );
}

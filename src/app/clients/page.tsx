import type { Metadata } from "next";
import { Card } from "@/components/ui/card";
import { Note } from "@/components/ui/note";
import { PageHeader } from "@/components/ui/page-header";
import { ClientsTable } from "@/features/clients/clients-table";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const { agency, clients, client, repository } = await getWorkspace();
  const rows = clients.map((c) => ({ client: c, coverage: repository.getCoverage(c.id) }));

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${agency.name} · ${clients.length} clients · selecting a client changes every page`}
      />
      <Card className="overflow-hidden">
        <ClientsTable rows={rows} selectedId={client.id} />
      </Card>
      <Note className="mt-3">
        Adding clients, connecting ad accounts and importing data arrive in later releases.
      </Note>
    </>
  );
}

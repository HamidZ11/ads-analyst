import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Note } from "@/components/ui/note";
import { PageHeader } from "@/components/ui/page-header";
import { ClientsTable } from "@/features/clients/clients-table";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Clients" };

export default async function ClientsPage() {
  const { agency, clients, client, repository } = await getWorkspace();
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
        description={`${agency.name} · ${clients.length} clients · selecting a client changes every page`}
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
      <Card className="overflow-hidden">
        <ClientsTable rows={rows} selectedId={client.id} />
      </Card>
      <Note className="mt-3">
        Demo clients are seeded and read-only. A new client is created from its first Meta Ads
        CSV export; later imports refresh the days they contain.
      </Note>
    </>
  );
}

import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { tracksRevenue } from "@/domain/labels";
import { ImportFlow, type ImportableClient } from "@/features/import/import-flow";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Import data" };

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { repository, client: current } = await getWorkspace();
  const requested = (await searchParams).client;
  const clients: ImportableClient[] = repository
    .listClients()
    .filter((c) => repository.getDataSource(c.id).kind === "meta_csv")
    .map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
      currency: c.currency,
      timezone: c.timezone,
      revenueTracked: tracksRevenue(c),
      accountId: repository.listAdAccounts(c.id)[0]?.externalId || null,
    }));
  const initial =
    requested === "new"
      ? "new"
      : typeof requested === "string" && clients.some((c) => c.id === requested)
        ? requested
        : clients.some((c) => c.id === current.id)
          ? current.id
          : "new";

  return (
    <>
      <PageHeader
        title="Import data"
        description="Meta Ads CSV export · checked here, then saved on this server"
      />
      <ImportFlow clients={clients} initialDestination={initial} />
    </>
  );
}

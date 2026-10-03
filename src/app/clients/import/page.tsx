import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { tracksRevenue } from "@/domain/labels";
import { ImportFlow, type ImportableClient } from "@/features/import/import-flow";
import { getWorkspaceContext } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Import data" };

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const {
    repository,
    client: current,
    clients: all,
    canImport,
    workspace,
  } = await getWorkspaceContext();
  const requested = (await searchParams).client;

  if (!canImport)
    return (
      <>
        <PageHeader title="Import data" description="Meta Ads CSV export" />
        <section aria-labelledby="import-unavailable" className="max-w-[560px]">
          <h2 id="import-unavailable" className="text-base font-semibold text-ink">
            Imports need a connected database
          </h2>
          <p className="mt-1 text-sm leading-5 text-ink-muted">
            This deployment runs on read-only demo data. Connect Supabase to sign in, create a
            workspace and import Meta Ads exports.
          </p>
          <Link href="/clients" className={buttonClasses("secondary", "md", "mt-4")}>
            Back to clients
          </Link>
        </section>
      </>
    );

  const clients: ImportableClient[] = all
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
        : current && clients.some((c) => c.id === current.id)
          ? current.id
          : "new";

  return (
    <>
      <PageHeader
        title="Import data"
        description={
          clients.length
            ? `Meta Ads CSV export · into ${workspace.name}`
            : `Meta Ads CSV export · your first import creates a client in ${workspace.name}`
        }
      />
      <ImportFlow clients={clients} initialDestination={initial} />
    </>
  );
}

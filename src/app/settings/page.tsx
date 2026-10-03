import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { PageHeader } from "@/components/ui/page-header";
import { AccountCard, ClientSettings } from "@/features/settings/client-settings";
import { getWorkspaceContext } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const context = await getWorkspaceContext();
  const { client, dataSource } = context;

  // An empty workspace still needs a way to see who is signed in and to sign out.
  if (!client || !dataSource)
    return (
      <>
        <PageHeader
          title="Settings"
          description={`${context.workspace.name} · no clients yet`}
          actions={
            <Link href="/clients/import?client=new" className={buttonClasses("primary")}>
              Import Meta CSV
            </Link>
          }
        />
        {context.user ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <AccountCard email={context.user.email} />
          </div>
        ) : null}
        <Note className="mt-4">
          Client settings appear here after your first Meta Ads CSV import.
        </Note>
      </>
    );

  const workspace = { ...context, client, dataSource };
  return (
    <>
      <PageHeader
        title="Settings"
        description={`${workspace.client.name} · client-level configuration`}
      />
      <ClientSettings workspace={workspace} />
      <Note className="mt-4">
        {workspace.dataSource.kind === "meta_csv"
          ? "Currency, business type and timezone are fixed after the first import because imported amounts and days depend on them."
          : "Demo clients are read-only. Import a Meta Ads CSV export from Clients to create a client whose targets you can edit."}
      </Note>
    </>
  );
}

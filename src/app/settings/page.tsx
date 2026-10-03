import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  AccountSection,
  ClientSettings,
  SettingsSection,
} from "@/features/settings/client-settings";
import { getWorkspaceContext } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const context = await getWorkspaceContext();
  const { client, dataSource } = context;
  const workspaceName =
    context.mode === "supabase" ? context.workspace.name : context.agency.name;

  // An empty workspace still shows who is signed in and the way out.
  if (!client || !dataSource)
    return (
      <>
        <PageHeader
          title="Settings"
          description={`${workspaceName} · no clients yet`}
          actions={
            <Link href="/clients/import?client=new" className={buttonClasses("primary")}>
              Import Meta CSV
            </Link>
          }
        />
        <div className="max-w-[880px]">
          <AccountSection
            mode={context.mode}
            email={context.user?.email ?? null}
            workspaceName={workspaceName}
          />
          <SettingsSection
            id="settings-client"
            title="Client"
            description="Client settings appear after your first Meta Ads CSV import."
          >
            <p className="py-2.5 text-sm text-ink-muted">No clients in this workspace yet.</p>
          </SettingsSection>
        </div>
      </>
    );

  return (
    <>
      <PageHeader title="Settings" description={`${client.name} · ${workspaceName}`} />
      <ClientSettings workspace={{ ...context, client, dataSource }} />
    </>
  );
}

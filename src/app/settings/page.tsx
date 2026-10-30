import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { BillingSection, parseNotice } from "@/features/billing/billing-section";
import { checkoutIntervals } from "@/features/billing/config";
import { loadBilling } from "@/features/billing/server";
import {
  AccountSection,
  ClientSettings,
  SettingsSection,
} from "@/features/settings/client-settings";
import { shareLinkView } from "@/features/report/share";
import { ShareLinksList } from "@/features/report/share-links-list";
import { getWorkspaceContext, loadSession } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const context = await getWorkspaceContext();
  const billing = await loadBilling();
  const billingSection = billing ? (
    <BillingSection
      subscription={billing.subscription}
      intervals={checkoutIntervals(billing.checkout)}
      portalConfigured={billing.checkout !== null}
      imports={billing.imports}
      notice={parseNotice((await searchParams).billing)}
      clientCount={context.clients.length}
    />
  ) : null;
  // Every link in the workspace that still opens, to revoke from here too (D-NEW-share-1).
  const session = await loadSession();
  const gateway = session.kind === "app" ? session.gateway : null;
  const shareLinks = gateway ? (
    <SettingsSection
      id="settings-share"
      title="Shared report links"
      description="Read-only links to client reports. Revoking one closes it at once."
    >
      <ShareLinksList
        links={await gateway
          .shareLinks(context.workspace.id)
          .then((all) =>
            all.map((link) => shareLinkView(link, context.clients)).filter((l) => l !== null),
          )
          .catch(() => [])}
        showClient
        empty="No active links. Create one from a client report with Share link."
      />
    </SettingsSection>
  ) : null;
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
          {billingSection}
          <SettingsSection
            id="settings-client"
            title="Client"
            description="Client settings and performance targets appear after your first Meta Ads CSV import."
          >
            <p className="py-2.5 text-sm text-ink-muted">No clients in this workspace yet.</p>
          </SettingsSection>
        </div>
      </>
    );

  return (
    <>
      <PageHeader title="Settings" description={`${client.name} · ${workspaceName}`} />
      <ClientSettings
        workspace={{ ...context, client, dataSource }}
        billing={billingSection}
        shareLinks={shareLinks}
      />
    </>
  );
}

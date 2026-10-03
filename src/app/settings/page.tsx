import type { Metadata } from "next";
import { Note } from "@/components/ui/note";
import { PageHeader } from "@/components/ui/page-header";
import { ClientSettings } from "@/features/settings/client-settings";
import { getWorkspace } from "@/features/workspace/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const workspace = await getWorkspace();
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

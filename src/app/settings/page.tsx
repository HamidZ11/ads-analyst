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
        eyebrow={workspace.client.name}
        title="Settings"
        description="Client-level configuration"
      />
      <ClientSettings workspace={workspace} />
      <Note className="mt-4">
        Settings are read-only in this release. Editing targets and connecting integrations
        arrive later.
      </Note>
    </>
  );
}

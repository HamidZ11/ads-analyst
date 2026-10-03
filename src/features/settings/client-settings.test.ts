import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { landingEvidence } from "@/features/marketing/evidence";
import type { Workspace } from "@/features/workspace/server";
import { AccountSection, ClientSettings } from "./client-settings";

function demoWorkspace(): Workspace {
  return landingEvidence().workspace;
}

function importedWorkspace(): Workspace {
  const base = landingEvidence().workspace;
  return {
    ...base,
    mode: "supabase",
    canImport: true,
    user: { id: "user_1", email: "ana@agency.test" },
    workspace: { id: "ws_1", name: "Ana's workspace" },
    dataSource: {
      clientId: base.client.id,
      kind: "meta_csv",
      imports: [
        {
          id: "imp_1",
          source: "meta_csv",
          importedAt: "2026-10-02T09:30:00.000Z",
          fileName: "luxe.csv",
          fileBytes: 1200,
          rows: 70,
          firstDate: "2026-09-17",
          lastDate: "2026-09-30",
          accountExternalId: "act_99",
          currency: "GBP",
          outcomeColumn: "Purchases",
          revenueColumn: "Purchases conversion value",
          daysAdded: 70,
          daysReplaced: 0,
        },
      ],
    },
  };
}

describe("Settings", () => {
  it("keeps demo clients read-only and says so once", () => {
    const html = renderToStaticMarkup(
      createElement(ClientSettings, { workspace: demoWorkspace() }),
    );
    expect(html).toContain("Demo clients are seeded and read-only.");
    expect(html).toContain("Performance targets");
    expect(html).toContain("£28.00");
    expect(html).not.toContain('name="targetCpa"');
    expect(html).not.toContain("Sign out");
    expect(html).not.toContain("Import a newer export");
  });

  it("lets imported clients edit targets with labelled inputs and import again", () => {
    const html = renderToStaticMarkup(
      createElement(ClientSettings, { workspace: importedWorkspace() }),
    );
    expect(html).toContain('name="targetCpa"');
    expect(html).toContain('<label for="target-cpa"');
    expect(html).toContain('id="target-cpa"');
    expect(html).toContain('role="status"');
    expect(html).toContain("Import a newer export");
    expect(html).toContain("/clients/import?client=cli_luxe");
    expect(html).toContain("Signed in as");
    expect(html).toContain("ana@agency.test");
    expect(html).toContain("Sign out");
  });

  it("labels each section with its heading", () => {
    const html = renderToStaticMarkup(
      createElement(AccountSection, { mode: "supabase", email: null, workspaceName: "W" }),
    );
    expect(html).toContain('aria-labelledby="settings-account"');
    expect(html).toContain('<h2 id="settings-account"');
  });
});

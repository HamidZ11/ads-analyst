import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ImportRecord } from "@/domain/types";
import { landingEvidence } from "@/features/marketing/evidence";
import { ClientsTable, type ClientListRow } from "./clients-table";

const imported: ImportRecord = {
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
  revenueColumn: null,
  daysAdded: 70,
  daysReplaced: 0,
};

function rows(): ClientListRow[] {
  const { workspace } = landingEvidence();
  const { repository } = workspace;
  const demo = workspace.clients.map((client) => ({
    client,
    coverage: repository.getCoverage(client.id),
    source: repository.getDataSource(client.id),
    accountId: repository.listAdAccounts(client.id)[0]?.externalId || null,
  }));
  const csvClient = {
    ...workspace.clients[0],
    id: "cli_csv",
    name: "Northwind Leads",
    type: "lead_generation" as const,
    targetCpa: null,
    targetRoas: null,
    revenueTracked: false,
  };
  return [
    ...demo,
    {
      client: csvClient,
      coverage: null,
      source: { clientId: "cli_csv", kind: "meta_csv", imports: [imported] },
      accountId: "act_99",
    },
  ];
}

describe("Clients table", () => {
  const html = renderToStaticMarkup(
    createElement(ClientsTable, { rows: rows(), selectedId: "cli_luxe" }),
  );

  it("renders demo and imported clients in both the table and the phone list", () => {
    expect(html).toContain("<table");
    expect(html).toContain('aria-label="Agency clients"');
    expect(html.match(/Luxe Skin Co\./g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain("Demo dataset");
    expect(html).toContain("Seeded · read-only");
    expect(html).toContain("Meta Ads · CSV import");
    expect(html).toContain("Last import 2 Oct");
  });

  it("groups targets and never invents missing ones", () => {
    expect(html).toContain("£28");
    expect(html).toContain("3.5x");
    // The imported lead client has no targets and records no conversion value.
    expect(html).toContain("Not set");
    expect(html).toContain("Not tracked");
    expect(html).toContain("No data yet");
  });

  it("marks the selected client and offers a labelled select action for the others", () => {
    expect(html).toContain("Selected");
    expect(html).toContain('aria-label="Select Northwind Leads"');
    expect(html).not.toContain('aria-label="Select Luxe Skin Co."');
  });
});

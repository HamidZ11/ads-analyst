import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import type { Client, ClientDataSource, Dataset, ImportRecord } from "@/domain/types";
import { importDestination } from "@/features/import/completion";
import { buildContext } from "@/features/workspace/context";
import { EMPTY_COPY, EmptyWorkspace, type EmptyPage } from "./empty-workspace";
import { EXPORT_STEPS } from "./export-steps";
import { GettingStarted, TargetsNudge, stepContent } from "./getting-started";
import { ImportedNote } from "./imported-note";
import { onboardingProgress, workspaceProgress, type OnboardingInput } from "./progress";

const seed = buildSeedDataset({ anchorDate: "2026-10-03" });
const luxe = seed.clients.find((c) => c.id === "cli_luxe")!;
const peak = seed.clients.find((c) => c.id === "cli_peak")!;

const record = (clientId: string, overrides: Partial<ImportRecord> = {}): ImportRecord => ({
  id: `imp_${clientId}`,
  source: "meta_csv",
  importedAt: "2026-10-02T09:30:00.000Z",
  fileName: "bloom-sept.csv",
  fileBytes: 25_000,
  rows: 70,
  firstDate: "2026-09-17",
  lastDate: "2026-09-30",
  accountExternalId: "1234567890",
  currency: "GBP",
  outcomeColumn: "Purchases",
  revenueColumn: "Purchases conversion value",
  daysAdded: 70,
  daysReplaced: 0,
  ...overrides,
});

const imported = (client: Client): ClientDataSource => ({
  clientId: client.id,
  kind: "meta_csv",
  imports: [record(client.id)],
});

const noTargets = (client: Client): Client => ({
  ...client,
  targetCpa: null,
  targetRoas: null,
});

function input(overrides: Partial<OnboardingInput> = {}): OnboardingInput {
  return {
    clients: [],
    sources: [],
    coverage: () => null,
    selectedClientId: null,
    ...overrides,
  };
}

const days14 = { firstDate: "2026-09-17", lastDate: "2026-09-30", days: 14, rows: 70 };
const statuses = (p: ReturnType<typeof onboardingProgress>) =>
  p.steps.map((s) => `${s.id}:${s.status}`);

describe("onboarding progress, read from workspace state", () => {
  it("starts a new workspace on its first client with nothing done", () => {
    const p = onboardingProgress(input());
    expect(statuses(p)).toEqual([
      "client:current",
      "import:upcoming",
      "findings:upcoming",
      "targets:upcoming",
    ]);
    expect(p).toMatchObject({ done: 0, ready: false, complete: false, client: null });
    expect(p.steps.find((s) => s.id === "targets")?.optional).toBe(true);
  });

  it("is ready once an imported client has stored days, leaving only the optional targets", () => {
    const client = noTargets(luxe);
    const p = onboardingProgress(
      input({ clients: [client], sources: [imported(client)], coverage: () => days14 }),
    );
    expect(statuses(p)).toEqual([
      "client:done",
      "import:done",
      "findings:done",
      "targets:current",
    ]);
    expect(p).toMatchObject({ done: 3, ready: true, complete: false });
    expect(p.client?.id).toBe("cli_luxe");
    expect(p.latestImport?.fileName).toBe("bloom-sept.csv");
  });

  it("does not count findings as seen without stored days", () => {
    const client = noTargets(luxe);
    const p = onboardingProgress(input({ clients: [client], sources: [imported(client)] }));
    expect(statuses(p).slice(0, 3)).toEqual(["client:done", "import:done", "findings:current"]);
    expect(p.ready).toBe(false);
  });

  it("does not count seeded clients as imports", () => {
    const p = onboardingProgress(
      input({
        clients: [luxe],
        sources: [{ clientId: luxe.id, kind: "seed", imports: [] }],
        coverage: () => days14,
      }),
    );
    expect(statuses(p).slice(0, 2)).toEqual(["client:done", "import:current"]);
    expect(p.client).toBeNull();
  });

  it("completes when any imported client has a cost or ROAS target", () => {
    const withTarget = { ...noTargets(peak), targetRoas: 3 };
    const p = onboardingProgress(
      input({
        clients: [noTargets(luxe), withTarget],
        sources: [imported(luxe), imported(peak)],
        coverage: () => days14,
      }),
    );
    expect(p).toMatchObject({ done: 4, ready: true, complete: true });
  });

  it("refers to the selected client when it was imported", () => {
    const p = onboardingProgress(
      input({
        clients: [noTargets(luxe), noTargets(peak)],
        sources: [imported(luxe), imported(peak)],
        coverage: () => days14,
        selectedClientId: "cli_peak",
      }),
    );
    expect(p.client?.id).toBe("cli_peak");
  });

  it("is never shown in demo mode", () => {
    const context = buildContext({
      mode: "demo",
      user: null,
      workspace: { id: "w", name: "Northstar Media" },
      repository: new InMemoryRepository(seed),
      requestedClientId: null,
      preset: "7d",
      canImport: false,
    });
    expect(workspaceProgress(context)).toBeNull();
  });

  it("reads a signed-in workspace through its repository", () => {
    const client = noTargets(luxe);
    const dataset: Dataset = {
      ...seed,
      clients: [client],
      dataSources: [imported(client)],
    };
    const context = buildContext({
      mode: "supabase",
      user: { id: "u", email: "ana@agency.test" },
      workspace: { id: "w", name: "Ana's workspace" },
      repository: new InMemoryRepository(dataset),
      requestedClientId: null,
      preset: "7d",
      canImport: true,
      now: new Date("2026-10-03T10:00:00Z"),
    });
    const p = workspaceProgress(context)!;
    expect(p).toMatchObject({ done: 3, ready: true, complete: false });
    expect(p.coverage?.days).toBeGreaterThan(0);
  });
});

describe("step copy", () => {
  it("states only what the workspace holds once a step is done", () => {
    const client = { ...noTargets(luxe), targetCpa: 28 };
    const p = onboardingProgress(
      input({ clients: [client], sources: [imported(client)], coverage: () => days14 }),
    );
    const detail = (id: string) =>
      stepContent(
        p.steps.find((s) => s.id === id)!,
        p,
      ).detail;
    expect(detail("client")).toBe("Luxe Skin Co. · Ecommerce · GBP");
    expect(detail("import")).toBe("bloom-sept.csv · 17 Sep – 30 Sep 2026 · 70 rows");
    expect(detail("findings")).toBe("14 days of Luxe Skin Co. in Insights");
    expect(detail("targets")).toBe("CPA £28 for Luxe Skin Co.");
  });

  it("offers a ROAS target only when the client records conversion value", () => {
    const leads = {
      ...noTargets(luxe),
      type: "lead_generation" as const,
      revenueTracked: false,
    };
    const p = onboardingProgress(
      input({ clients: [leads], sources: [imported(leads)], coverage: () => days14 }),
    );
    const targets = stepContent(p.steps[3], p).description;
    expect(targets).toContain("cost per lead target");
    expect(targets).not.toContain("ROAS");
  });
});

describe("getting started", () => {
  it("shows four steps, the current one with the single primary action and the export steps", () => {
    const html = renderToStaticMarkup(
      createElement(GettingStarted, { progress: onboardingProgress(input()) }),
    );
    expect(html).toContain("Get started");
    expect(html).toContain("0 of 4 done");
    expect(html.match(/aria-current="step"/g)).toHaveLength(1);
    expect(html).toContain("Add your first client");
    expect(html).toContain("Import a Meta Ads CSV");
    expect(html).toContain("See your first findings");
    expect(html).toContain("Set targets");
    expect(html.match(/bg-accent /g)).toHaveLength(1);
    expect(html).toContain('href="/clients/import?client=new"');
    expect(html).toContain("How to export from Ads Manager");
    for (const step of EXPORT_STEPS) expect(html).toContain(step.title);
  });

  it("nudges once toward targets, only when findings can be read and none is set", () => {
    const client = noTargets(luxe);
    const ready = onboardingProgress(
      input({ clients: [client], sources: [imported(client)], coverage: () => days14 }),
    );
    const html = renderToStaticMarkup(createElement(TargetsNudge, { progress: ready }));
    expect(html).toContain("Next, optional:");
    expect(html).toContain('href="/settings#settings-targets"');
    expect(html).not.toContain("Optional. ");

    const fresh = renderToStaticMarkup(
      createElement(TargetsNudge, { progress: onboardingProgress(input()) }),
    );
    expect(fresh).toBe("");
    const done = renderToStaticMarkup(
      createElement(TargetsNudge, {
        progress: onboardingProgress(
          input({
            clients: [{ ...client, targetCpa: 20 }],
            sources: [imported(client)],
            coverage: () => days14,
          }),
        ),
      }),
    );
    expect(done).toBe("");
  });
});

describe("empty states", () => {
  const pages: EmptyPage[] = [
    "overview",
    "campaigns",
    "creatives",
    "insights",
    "ask",
    "clients",
  ];
  const render = (page: EmptyPage) =>
    renderToStaticMarkup(
      createElement(EmptyWorkspace, {
        page,
        workspaceName: "Ana's workspace",
        progress: onboardingProgress(input()),
      }),
    );

  it.each(pages)(
    "%s says what will appear, what produces it, and offers one next action",
    (page) => {
      const html = render(page);
      const copy = EMPTY_COPY[page];
      expect(html).toContain("Ana&#x27;s workspace · no clients yet");
      expect(html).toContain(copy.title);
      expect(html).toContain(copy.appears);
      expect(html).toContain(copy.source);
      // One primary action, pointing at the first import.
      expect(html.match(/bg-accent /g)).toHaveLength(1);
      expect(html).toContain('href="/clients/import?client=new"');
      // Honest placeholders: no figures from anywhere.
      expect(html).not.toMatch(/[£$€]\s?\d/);
      expect(html).not.toMatch(/\d+(\.\d+)?%/);
    },
  );

  it("puts the checklist on Insights, where sign-in lands", () => {
    expect(render("insights")).toContain("Get started");
    for (const page of pages.filter((p) => p !== "insights"))
      expect(render(page)).not.toContain("Get started");
  });

  it("names the action after what the page needs", () => {
    expect(render("clients")).toContain("Add your first client");
    expect(render("overview")).toContain("Import a Meta Ads export");
  });
});

describe("after the first import", () => {
  it("lands on Insights; later imports still offer the Overview", () => {
    expect(importDestination(true)).toEqual({
      href: "/insights?imported=1",
      label: "View findings",
    });
    expect(importDestination(false)).toEqual({ href: "/overview", label: "View Overview" });
  });

  it("names the stored import above the findings and offers targets once", () => {
    const client = noTargets(luxe);
    const source = imported(client);
    const progress = onboardingProgress(
      input({ clients: [client], sources: [source], coverage: () => days14 }),
    );
    const html = renderToStaticMarkup(
      createElement(ImportedNote, { client, dataSource: source, progress }),
    );
    expect(html).toContain('role="status"');
    expect(html).toContain("bloom-sept.csv");
    expect(html).toContain("17 Sep – 30 Sep 2026");
    expect(html).toContain("70 rows");
    expect(html).toContain("Set targets");
  });

  it("renders nothing for a client without imports", () => {
    const html = renderToStaticMarkup(
      createElement(ImportedNote, {
        client: luxe,
        dataSource: { clientId: luxe.id, kind: "seed", imports: [] },
        progress: null,
      }),
    );
    expect(html).toBe("");
  });
});

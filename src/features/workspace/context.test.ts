import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import type { Dataset } from "@/domain/types";
import { buildContext, chooseActive, defaultWorkspaceName } from "./context";

const seed = buildSeedDataset({ anchorDate: "2026-10-03" });

describe("selection", () => {
  it("lets a cookie choose only among accessible items", () => {
    const items = [{ id: "a" }, { id: "b" }];
    expect(chooseActive(items, "b")).toEqual({ id: "b" });
    expect(chooseActive(items, "forged-or-stale")).toEqual({ id: "a" });
    expect(chooseActive(items, undefined)).toEqual({ id: "a" });
    expect(chooseActive([], "a")).toBeNull();
  });

  it("falls back to the first accessible client for a client from elsewhere", () => {
    const context = buildContext({
      mode: "demo",
      user: null,
      workspace: { id: "w", name: "W" },
      repository: new InMemoryRepository(seed),
      requestedClientId: "cli_from_another_workspace",
      preset: "7d",
      canImport: false,
      now: new Date("2026-10-03T10:00:00Z"),
    });
    expect(context.client?.id).toBe("cli_luxe");
  });

  it("represents an empty workspace without inventing a client", () => {
    const empty: Dataset = {
      ...seed,
      clients: [],
      adAccounts: [],
      campaigns: [],
      adSets: [],
      ads: [],
      creatives: [],
      dailyMetrics: [],
    };
    const context = buildContext({
      mode: "supabase",
      user: { id: "u", email: "ana@agency.test" },
      workspace: { id: "w", name: "Ana's workspace" },
      repository: new InMemoryRepository(empty),
      requestedClientId: "anything",
      preset: "7d",
      canImport: true,
      now: new Date("2026-10-03T10:00:00Z"),
    });
    expect([context.client, context.adAccount, context.coverage, context.dataSource]).toEqual([
      null,
      null,
      null,
      null,
    ]);
    expect(context.clients).toEqual([]);
    expect(context.periods.current.end).toBe("2026-10-03");
  });

  it("names a first workspace after the account", () => {
    expect(defaultWorkspaceName("ana.smith@agency.test")).toBe("Ana.smith's workspace");
    expect(defaultWorkspaceName("<script>@x.test")).toBe("Script's workspace");
    expect(defaultWorkspaceName(null)).toBe("My workspace");
  });
});

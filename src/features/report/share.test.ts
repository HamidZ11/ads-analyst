import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import { buildContext } from "@/features/workspace/context";
import { ClientReport } from "./client-report";
import { buildClientReport } from "./report-model";
import {
  isSharePreset,
  newShareToken,
  SHARE_TOKEN,
  sharedPeriods,
  shareLinkView,
  sharePath,
} from "./share";

describe("share tokens", () => {
  it("are 256 random bits as 43 base64url characters, never repeated", () => {
    const tokens = Array.from({ length: 2000 }, newShareToken);
    for (const token of tokens) {
      expect(token).toMatch(SHARE_TOKEN);
      expect(Buffer.from(token, "base64url")).toHaveLength(32);
    }
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(sharePath(tokens[0])).toBe(`/r/${tokens[0]}`);
  });
});

describe("a link's period", () => {
  it("pins the dates and compares with the equally long period before", () => {
    expect(sharedPeriods("7d", "2026-09-21", "2026-09-27")).toEqual({
      preset: "7d",
      current: { start: "2026-09-21", end: "2026-09-27" },
      previous: { start: "2026-09-14", end: "2026-09-20" },
    });
    expect(sharedPeriods("yesterday", "2026-09-27", "2026-09-27")?.previous).toEqual({
      start: "2026-09-26",
      end: "2026-09-26",
    });
    expect(sharedPeriods("30d", "2026-09-01", "2026-09-30")?.previous.start).toBe("2026-08-02");
  });

  it("refuses dates that aren't the preset's length or aren't real dates", () => {
    expect(sharedPeriods("7d", "2026-09-22", "2026-09-27")).toBeNull();
    expect(sharedPeriods("today", "2026-09-26", "2026-09-27")).toBeNull();
    expect(sharedPeriods("7d", "2026-02-24", "2026-02-30")).toBeNull();
    expect(sharedPeriods("7d", "21/09/2026", "2026-09-27")).toBeNull();
    expect(isSharePreset("custom")).toBe(false);
    expect(isSharePreset("14d")).toBe(true);
  });
});

describe("listing links", () => {
  it("labels a link in its client's timezone and drops links to unknown clients", () => {
    const link = {
      id: "l1",
      clientId: "c1",
      preset: "7d" as const,
      periodStart: "2026-09-21",
      periodEnd: "2026-09-27",
      createdAt: "2026-10-30T23:30:00.000Z",
      expiresAt: "2026-11-29T23:30:00.000Z",
    };
    const clients = [{ id: "c1", name: "Bloom Botanicals", timezone: "Europe/London" }];
    expect(shareLinkView(link, clients)).toEqual({
      id: "l1",
      clientName: "Bloom Botanicals",
      periodLabel: "21 Sep – 27 Sep 2026",
      // 23:30 UTC is still the 30th in London (GMT from 25 October).
      createdLabel: "30 Oct 2026",
      expiresLabel: "29 Nov 2026",
    });
    expect(
      shareLinkView(link, [{ id: "c1", name: "Bloom", timezone: "Asia/Tokyo" }])?.createdLabel,
    ).toBe("31 Oct 2026");
    expect(shareLinkView(link, [])).toBeNull();
  });
});

describe("the shared report", () => {
  const workspace = () => {
    const context = buildContext({
      mode: "supabase",
      user: null,
      workspace: { id: "ws", name: "Northwind Media" },
      repository: new InMemoryRepository(buildSeedDataset()),
      requestedClientId: "cli_luxe",
      preset: "7d",
      canImport: false,
    });
    return { ...context, client: context.client!, dataSource: context.dataSource! };
  };

  it("is read only: the note is text, with no form, textarea or save", () => {
    const html = renderToStaticMarkup(
      createElement(ClientReport, {
        model: buildClientReport(workspace()),
        note: { body: "We are moving budget to the serum.", updatedAt: "" },
        canSave: false,
        shared: true,
      }),
    );
    expect(html).toContain("What we&#x27;re doing next");
    expect(html).toContain("We are moving budget to the serum.");
    expect(html).not.toMatch(/<form|<textarea|<button|Save note/);
  });

  it("leaves the note section out when there is no note", () => {
    const html = renderToStaticMarkup(
      createElement(ClientReport, {
        model: buildClientReport(workspace()),
        note: null,
        canSave: false,
        shared: true,
      }),
    );
    expect(html).not.toContain("What we&#x27;re doing next");
    expect(html).toContain('id="report-results"');
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import { runInsightEngine } from "@/domain/insights";
import { primaryMetricKeys } from "@/domain/labels";
import type { DatePreset } from "@/domain/periods";
import {
  getCampaignRows,
  getClientPeriodSummary,
  getCreativeRows,
  getKpiReadings,
} from "@/features/analytics/queries";
import { collectInsightFacts } from "@/features/insights/facts";
import { buildContext } from "@/features/workspace/context";
import type { Workspace } from "@/features/workspace/server";
import { ClientReport } from "./client-report";
import { plainLanguage, suggestedNextSteps } from "./client-wording";
import { conversionVocabulary } from "@/domain/labels";
import { buildClientReport, REPORT_CAMPAIGNS, REPORT_FINDINGS } from "./report-model";

vi.mock("./actions", () => ({ saveReportNote: vi.fn() }));

const repository = new InMemoryRepository(buildSeedDataset({ anchorDate: "2026-10-03" }));
const CLIENTS = ["cli_luxe", "cli_peak", "cli_arc"];
const PRESETS: DatePreset[] = ["today", "yesterday", "7d", "14d", "30d"];

function workspace(clientId: string, preset: DatePreset = "7d"): Workspace {
  const context = buildContext({
    mode: "demo",
    user: null,
    workspace: { id: "agency_northstar", name: "Northstar Media" },
    repository,
    requestedClientId: clientId,
    preset,
    canImport: false,
    now: new Date("2026-10-03T10:00:00Z"),
  });
  return { ...context, client: context.client!, dataSource: context.dataSource! };
}

/** Numbers as written: "£1,234", "31.4%", "3.50x", "12". */
const NUMBER = /\d[\d,]*(?:\.\d+)?/g;
const JARGON = /\b(CTR|CPM|CPC|CPA|ROAS|proxy|detector|fatigue)\b/i;

describe("client report model", () => {
  it("shows exactly the Overview's headline metrics for every client and period", () => {
    for (const id of CLIENTS)
      for (const preset of PRESETS) {
        const ws = workspace(id, preset);
        const report = buildClientReport(ws);
        const readings = getKpiReadings(
          getClientPeriodSummary(ws.repository, ws.client, ws.periods),
          primaryMetricKeys(ws.client),
        );
        expect(report.metrics.map((m) => [m.key, m.current, m.previous, m.change])).toEqual(
          readings.map((r) => [r.key, r.current, r.previous, r.change]),
        );
        expect(report.currentLabel).not.toBe("");
        expect(report.current).toEqual(ws.periods.current);
        expect(report.previous).toEqual(ws.periods.previous);
      }
  });

  it("ranks campaigns and creatives by spend with the Campaigns and Creatives figures", () => {
    for (const id of CLIENTS) {
      const ws = workspace(id, "14d");
      const report = buildClientReport(ws);
      const campaigns = getCampaignRows(ws.repository, ws.client, ws.periods)
        .filter((r) => r.current.totals.spend > 0)
        .sort((a, b) => b.current.totals.spend - a.current.totals.spend);
      expect(report.campaignTotal).toBe(campaigns.length);
      expect(report.campaigns).toHaveLength(Math.min(REPORT_CAMPAIGNS, campaigns.length));
      report.campaigns.forEach((row, i) => {
        expect(row.id).toBe(campaigns[i].campaign.id);
        expect(row.spend).toBe(campaigns[i].current.totals.spend);
        expect(row.conversions).toBe(campaigns[i].current.totals.conversions);
        expect(row.cpa).toBe(campaigns[i].current.derived.cpa);
        expect(row.spendChange).toBe(campaigns[i].spendChange);
        expect(row.conversionsChange).toBe(campaigns[i].conversionsChange);
      });
      const creatives = getCreativeRows(ws.repository, ws.client, ws.periods)
        .filter((r) => r.current.totals.spend > 0)
        .sort((a, b) => b.current.totals.spend - a.current.totals.spend);
      report.creatives.forEach((row, i) => {
        expect(row.id).toBe(creatives[i].creative.id);
        expect(row.spend).toBe(creatives[i].current.totals.spend);
        expect(row.cpa).toBe(creatives[i].current.derived.cpa);
      });
      // Top campaigns' spend never exceeds the headline spend.
      const spend = report.metrics.find((m) => m.key === "spend")!.current!;
      expect(report.campaigns.reduce((s, r) => s + r.spend, 0)).toBeLessThanOrEqual(
        spend + 1e-6,
      );
    }
  });

  it("takes its findings from the insight engine, in its order", () => {
    for (const id of CLIENTS) {
      const ws = workspace(id);
      const findings = runInsightEngine(
        collectInsightFacts(ws.repository, ws.client, ws.periods),
      );
      const report = buildClientReport(ws);
      expect(report.findingTotal).toBe(findings.length);
      expect(report.findings.map((f) => f.id)).toEqual(
        findings.slice(0, REPORT_FINDINGS).map((f) => f.id),
      );
    }
    // The flagship client has something to report.
    expect(buildClientReport(workspace("cli_luxe")).findings.length).toBeGreaterThan(0);
  });

  it("words every finding for a client: no jargon, the same numbers", () => {
    let checked = 0;
    for (const id of CLIENTS)
      for (const preset of PRESETS) {
        const ws = workspace(id, preset);
        const report = buildClientReport(ws);
        for (const finding of runInsightEngine(
          collectInsightFacts(ws.repository, ws.client, ws.periods),
        )) {
          const wording = report.findings.find((f) => f.id === finding.id);
          if (!wording) continue;
          checked += 1;
          for (const text of [wording.title, wording.where, wording.sentence, wording.nextStep])
            expect(text, text).not.toMatch(JARGON);
          // Every figure in the client sentence is a figure from the engine's headline.
          const internal = new Set(finding.headline.match(NUMBER) ?? []);
          for (const n of wording.sentence.match(NUMBER) ?? [])
            expect(internal.has(n) || n === "1,000", `${n} in "${wording.sentence}"`).toBe(
              true,
            );
          // And no figure is dropped.
          expect(
            (wording.sentence.match(NUMBER) ?? []).filter((n) => n !== "1,000").sort(),
          ).toEqual([...internal].sort());
        }
      }
    expect(checked).toBeGreaterThan(5);
  });

  it("translates platform shorthand into plain words", () => {
    expect(plainLanguage("CTR fell 12.0% while CPM held steady.")).toBe(
      "Click-through rate fell 12.0% while the cost per 1,000 impressions held steady.",
    );
    expect(plainLanguage("ROAS fell 20.1% to 2.10x.")).toBe(
      "Return on ad spend fell 20.1% to 2.10x.",
    );
  });

  it("names cost per conversion with the client's own label, as the report's tiles do", () => {
    const vocab = conversionVocabulary("lead_generation");
    expect(plainLanguage("CPA rose 18.0% to £42.10.", vocab)).toBe(
      "Cost per lead rose 18.0% to £42.10.",
    );
    expect(plainLanguage("Blended CPA held at £9.00.", conversionVocabulary("ecommerce"))).toBe(
      "Blended cost per purchase held at £9.00.",
    );
    expect(plainLanguage("CPA rose.")).toBe("Cost per result rose.");
  });

  it("drafts next steps from the findings, one line each", () => {
    const report = buildClientReport(workspace("cli_luxe"));
    const draft = suggestedNextSteps(report.findings);
    expect(draft.split("\n")).toHaveLength(report.findings.length);
    expect(draft).not.toMatch(JARGON);
  });

  it("names the agency and labels demo data as a sample", () => {
    const report = buildClientReport(workspace("cli_luxe"));
    expect(report.agencyName).toBe("Northstar Media");
    expect(report.demo).toBe(true);
    const html = renderToStaticMarkup(
      createElement(ClientReport, { model: report, note: null, canSave: false }),
    );
    expect(html).toContain("Northstar Media");
    expect(html).toContain("Luxe Skin Co.");
    expect(html).toContain("Sample report.");
    expect(html).toContain("seeded demo dataset");
    expect(html).toContain("isn&#x27;t saved");
    expect(html).not.toContain("Save note");
    for (const id of [
      "report-results",
      "report-findings",
      "report-campaigns",
      "report-creatives",
    ])
      expect(html).toContain(`id="${id}"`);
  });

  it("words the comparison so it reads for every preset", () => {
    const expected: Record<string, string> = {
      today: "Compared with yesterday",
      yesterday: "Compared with the day before",
      "7d": "Compared with the previous 7 days",
      "14d": "Compared with the previous 14 days",
      "30d": "Compared with the previous 30 days",
    };
    for (const preset of PRESETS) {
      const report = buildClientReport(workspace("cli_luxe", preset));
      const html = renderToStaticMarkup(
        createElement(ClientReport, { model: report, note: null, canSave: false }),
      );
      expect(html).toContain(expected[preset]);
      expect(html).toContain(`and ${report.previousLabel}`);
      expect(html).not.toMatch(/\bthe (yesterday|the\b)/i);
    }
  });

  it("renders a saved note for printing and offers saving when stored", () => {
    const report = buildClientReport(workspace("cli_peak"));
    const html = renderToStaticMarkup(
      createElement(ClientReport, {
        model: { ...report, demo: false },
        note: { body: "Moving budget to the best ad.", updatedAt: "2026-10-03T10:00:00Z" },
        canSave: true,
      }),
    );
    expect(html).toContain("Save note");
    expect(html).not.toContain("Sample report.");
    // Once in the print-only copy, once in the textarea.
    expect(html.split("Moving budget to the best ad.").length - 1).toBe(2);
  });

  it("uses the same chart builder as Insights and skips charts for one-day periods", () => {
    expect(buildClientReport(workspace("cli_luxe", "7d")).charts.map((c) => c.title)).toEqual([
      "Daily purchases",
      "Daily spend",
    ]);
    expect(buildClientReport(workspace("cli_luxe", "today")).charts).toEqual([]);
  });
});

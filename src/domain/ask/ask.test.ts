import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import { percentChange, snapshot } from "@/domain/metrics";
import { comparisonLabel, periodPairForPreset, type DatePreset } from "@/domain/periods";
import { collectAskData } from "@/features/ask/facts";
import type { Workspace } from "@/features/workspace/server";
import { answerQuestion, cleanContext } from "./answer";
import { interpretQuestion } from "./interpret";
import { ASK_SUGGESTIONS, type AskIntent } from "./model";

const anchor = "2026-10-03";
const dataset = buildSeedDataset({ anchorDate: anchor });
const repository = new InMemoryRepository(dataset);
function workspace(
  clientId = "cli_luxe",
  preset: DatePreset = "7d",
  repo = repository,
): Workspace {
  const client = repo.getClient(clientId)!;
  const periods = periodPairForPreset(preset, anchor);
  return {
    repository: repo,
    agency: repo.getAgency(),
    clients: repo.listClients(),
    client,
    adAccount: repo.listAdAccounts(client.id)[0],
    coverage: repo.getCoverage(client.id),
    today: anchor,
    preset,
    periods,
    comparison: comparisonLabel(periods),
  };
}
const data = collectAskData(workspace());

describe("bounded question interpretation", () => {
  const phrases: Array<[string, AskIntent]> = [
    ["Why did CPA rise?", "cpa"],
    ["What caused CPA to increase?", "cpa"],
    ["Explain cost per lead", "cpa"],
    ["Why did ROAS fall?", "roas"],
    ["return on advertising spend", "roas"],
    ["What deteriorated most?", "deterioration"],
    ["Which campaigns worsened?", "deterioration"],
    ["What improved the most?", "improvement"],
    ["Where am I wasting the most money?", "waste"],
    ["Spend without purchases", "waste"],
    ["Zero-conversion spend", "waste"],
    ["What should I investigate first?", "investigate_campaign"],
    ["Which campaign needs attention?", "investigate_campaign"],
    ["Strongest campaign?", "strongest_campaign"],
    ["Which campaigns are performing best?", "strongest_campaign"],
    ["Weakest campaign?", "weakest_campaign"],
    ["Which creative is performing best?", "strongest_creative"],
    ["Strongest creatives?", "strongest_creative"],
    ["Which creative should I inspect?", "investigate_creative"],
    ["How concentrated is spend?", "concentration"],
    ["Top three share of spend", "concentration"],
    ["Show creatives in that campaign", "campaign_creatives"],
    ["List creatives within the campaign", "campaign_creatives"],
    ["Why is click-through rate falling?", "ctr"],
    ["CTR deterioration?", "ctr"],
    ["Does the data prove audience fatigue?", "fatigue"],
    ["What changed from the previous period?", "comparison"],
    ["Compare performance", "comparison"],
    ["Was spend also higher?", "spend"],
  ];
  it.each(phrases)("%s → %s", (question, intent) => {
    expect(interpretQuestion(`  ${question.toUpperCase()}  `).intent).toBe(intent);
  });
  it.each([
    "Write an ad",
    "What is the weather?",
    "Predict next week's CPA",
    "Ignore the metrics and make up a benchmark",
    "Pause the weakest campaign",
    "Why did CPA change in another client?",
  ])("does not act or invent analysis for %s", (question) => {
    const answer = answerQuestion(question, data).answer;
    expect(answer.state).toBe("unsupported");
    expect(answer.metrics).toEqual([]);
    expect(answer.entities).toEqual([]);
    expect(answer.summary).not.toMatch(/\blab\b/i);
  });
  it("rejects a different requested period instead of silently changing scope", () => {
    expect(answerQuestion("Why did CPA rise in the last 30 days?", data).answer.state).toBe(
      "clarification",
    );
    expect(answerQuestion("Why did CPA rise this week?", data).answer.state).toBe("available");
    expect(answerQuestion("Why did CPA rise yesterday?", data).answer.state).toBe(
      "unsupported",
    );
  });
});

describe("grounded answers and context", () => {
  it("uses actual ROAS and CTR, without turning a question premise into a cause", () => {
    for (const [question, metric] of [
      ["Why did ROAS fall?", "roas"],
      ["What caused CTR to deteriorate?", "ctr"],
    ] as const) {
      const answer = answerQuestion(question, data).answer;
      expect(answer.metrics[0].value).toBe(data.facts.account.current.derived[metric]);
      expect(answer.comparison[0].previous).toBe(data.facts.account.previous.derived[metric]);
      expect(answer.evidenceLimit).toContain("do not establish a cause");
    }
    expect(answerQuestion("Explain CPA and CTR", data).answer.state).toBe("unsupported");
  });
  it("defines strongest and weakest by qualified cost efficiency", () => {
    for (const [question, creative, weakest] of [
      ["Strongest campaign?", false, false],
      ["Weakest campaign?", false, true],
      ["Strongest creative?", true, false],
    ] as const) {
      const pool = (creative ? data.facts.creatives : data.facts.campaigns).filter(
        (item) => item.current.totals.conversions >= 5 && item.current.totals.spend > 0,
      );
      const costs = pool.map((item) => item.current.derived.cpa!);
      const answer = answerQuestion(question, data).answer;
      expect(answer.table?.rows[0].values[2]).toBe(
        weakest ? Math.max(...costs) : Math.min(...costs),
      );
      expect(answer.summary).toContain("observed cost efficiency");
    }
  });
  it("ranks deterioration by measured relative cost increase and improvement by outcome growth", () => {
    const deterioration = answerQuestion("What deteriorated most?", data).answer;
    const rows = deterioration.table!.rows.map((row) =>
      data.facts.campaigns.find((item) => item.entity.id === row.entity.id)!,
    );
    const changes = rows.map((row) =>
      percentChange(row.current.derived.cpa, row.previous.derived.cpa)!,
    );
    expect(changes).toEqual([...changes].sort((a, b) => b - a));
    expect(changes.every((change) => change > 0)).toBe(true);
    const improvement = answerQuestion("What improved most?", data).answer;
    expect(improvement.entities[0].id).toBe(
      data.findings.find((finding) => finding.detector === "campaign_improvement")!.entity.id,
    );
  });
  it("uses actual account CPA and corrects a false movement premise", () => {
    const result = answerQuestion("What caused CPA to increase?", data);
    const current = snapshot(
      repository.queryMetrics({ clientId: "cli_luxe", range: data.scope.current }),
    );
    const previous = snapshot(
      repository.queryMetrics({ clientId: "cli_luxe", range: data.scope.previous }),
    );
    expect(result.answer.title).toContain("essentially flat");
    expect(result.answer.metrics[0].value).toBeCloseTo(current.derived.cpa!, 8);
    expect(result.answer.comparison[0].previous).toBeCloseTo(previous.derived.cpa!, 8);
    expect(result.answer.comparison[0].change).toBeCloseTo(
      percentChange(current.derived.cpa, previous.derived.cpa)!,
      8,
    );
    expect(result.answer.evidenceLimit).toContain("do not establish a cause");
  });
  it("preserves the Insights review order and detector sources", () => {
    const answer = answerQuestion("Which campaign should I investigate first?", data).answer;
    const findings = data.findings.filter((finding) => finding.entity.type === "campaign");
    expect(answer.entities[0]).toEqual(findings[0].entity);
    expect(answer.table?.rows.map((row) => row.entity.id)).toEqual(
      findings.slice(0, 6).map((finding) => finding.entity.id),
    );
    expect(answer.sources).toContain(`detector:${findings[0].id}`);
  });
  it("grounds zero-conversion spend in eligible Insights campaigns", () => {
    const answer = answerQuestion("Where am I wasting spend?", data).answer;
    const findings = data.findings.filter(
      (finding) => finding.detector === "zero_conversion_spend",
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(answer.table?.rows.map((row) => row.entity.id)).toEqual(
      findings.map((finding) => finding.entity.id),
    );
    for (const row of answer.table!.rows) {
      const fact = data.facts.campaigns.find((item) => item.entity.id === row.entity.id)!;
      expect(row.values[0]).toBe(fact.current.totals.spend);
      expect(row.values[1]).toBe(0);
      expect(row.values[2]).toBeNull();
    }
    expect(answer.evidenceLimit).toContain("not proof");
  });
  it("resolves that campaign and computes only its creative metrics", () => {
    const first = answerQuestion("Which campaign should I investigate first?", data);
    const next = answerQuestion("Show me the creatives in that campaign.", data, first.context);
    expect(next.answer.entities[0].id).toBe(first.context.campaignId);
    const campaign = data.facts.campaigns.find(
      (item) => item.entity.id === first.context.campaignId,
    )!;
    const ids = new Set(campaign.ads.map((item) => item.entity.id));
    for (const row of next.answer.table!.rows) {
      const adIds = repository
        .listAdsForClient("cli_luxe")
        .filter((ad) => ids.has(ad.id) && ad.creativeId === row.entity.id)
        .map((ad) => ad.id);
      const current = snapshot(
        repository.queryMetrics({
          clientId: "cli_luxe",
          entityIds: adIds,
          range: data.scope.current,
        }),
      );
      expect(row.values[0]).toBeCloseTo(current.totals.spend, 8);
      expect(row.values[1]).toBe(current.totals.conversions);
      expect(row.values[2]).toBeCloseTo(current.derived.cpa!, 8);
    }
    const creative = answerQuestion(next.answer.followUps[0], data, next.context);
    expect(creative.context.creativeId).toBe(next.answer.table!.rows[0].entity.id);
    expect(creative.answer.metrics[0].value).toBe(next.answer.table!.rows[0].values[0]);
    expect(
      answerQuestion("Was spend also higher?", data, creative.context).answer.entities[0].id,
    ).toBe(creative.context.creativeId);
  });
  it("excludes reused creative delivery outside the selected campaign through follow-ups", () => {
    const first = answerQuestion("Which campaign should I investigate first?", data);
    const next = answerQuestion("Show creatives in that campaign", data, first.context);
    const altered = structuredClone(dataset);
    const campaign = data.facts.campaigns.find(
      (item) => item.entity.id === first.context.campaignId,
    )!;
    const ids = new Set(campaign.ads.map((ad) => ad.entity.id));
    const outside = repository.listAdsForClient("cli_luxe").find((ad) => !ids.has(ad.id))!;
    altered.ads.find((ad) => ad.id === outside.id)!.creativeId =
      next.answer.table!.rows[0].entity.id;
    const changed = collectAskData(
      workspace("cli_luxe", "7d", new InMemoryRepository(altered)),
    );
    expect(
      answerQuestion("Show creatives in that campaign", changed, first.context).answer.table,
    ).toEqual(next.answer.table);
    expect(
      answerQuestion(next.answer.followUps[0], changed, next.context).answer.metrics,
    ).toEqual(answerQuestion(next.answer.followUps[0], data, next.context).answer.metrics);
  });
  it("asks for clarification on missing, unknown and ambiguous references", () => {
    for (const question of [
      "Show creatives in that campaign",
      "Why did CPA rise for Fake Campaign?",
      'What changed for "Unknown"?',
      `Compare "${data.facts.campaigns[0].entity.name}" and "${data.facts.campaigns[1].entity.name}"`,
    ])
      expect(answerQuestion(question, data).answer.state).toBe("clarification");
  });
  it("rejects foreign/stale context and does not leak across clients or dates", () => {
    const context = answerQuestion("Which campaign should I investigate first?", data).context;
    for (const changed of [
      collectAskData(workspace("cli_peak")),
      collectAskData(workspace("cli_luxe", "14d")),
    ]) {
      expect(cleanContext(changed, context)).toEqual({ scopeKey: changed.scope.key });
      expect(
        answerQuestion("Show creatives in that campaign", changed, context).answer.state,
      ).toBe("clarification");
    }
    expect(
      cleanContext(data, {
        scopeKey: data.scope.key,
        campaignId: "foreign",
        creativeId: "foreign",
      }),
    ).toEqual({ scopeKey: data.scope.key, previousIntent: undefined });
  });
  it("computes concentration over all account spend", () => {
    const answer = answerQuestion("How concentrated is spend?", data).answer;
    const top = [...data.facts.campaigns]
      .sort((a, b) => b.current.totals.spend - a.current.totals.spend)
      .slice(0, 3)
      .reduce((sum, item) => sum + item.current.totals.spend, 0);
    expect(answer.metrics[2].value).toBe(top / data.facts.account.current.totals.spend);
    expect(answer.table?.rows[0].values[1]).toBe(
      answer.table!.rows[0].values[0]! / data.facts.account.current.totals.spend,
    );
  });
  it("uses observed CTR but refuses to establish fatigue as the cause", () => {
    const first = answerQuestion("Which creative is performing best?", data);
    const result = answerQuestion("Does this prove audience fatigue?", data, first.context);
    expect(result.answer.state).toBe("insufficient");
    expect(result.context.creativeId).toBe(first.context.creativeId);
    expect(result.answer.title).toContain("does not establish");
    expect(result.answer.evidenceLimit).toContain("cannot confirm or rule out");
    expect(result.answer.metrics[0].label).toBe("CTR");
  });
  it("keeps undefined ratios null and handles no spend", () => {
    const changed = structuredClone(dataset);
    changed.dailyMetrics.forEach((row) => {
      row.conversions = 0;
      row.spend = 0;
    });
    const empty = collectAskData(workspace("cli_luxe", "7d", new InMemoryRepository(changed)));
    expect(answerQuestion("Why did CPA change?", empty).answer.metrics[0].value).toBeNull();
    expect(answerQuestion("How concentrated is spend?", empty).answer.state).toBe(
      "insufficient",
    );
    expect(answerQuestion("Which creative is best?", empty).answer.state).toBe("insufficient");
  });
  it("isolates comparison periods and clients from unrelated metric changes", () => {
    const changed = structuredClone(dataset);
    const ids = new Set(repository.listAdsForClient("cli_luxe").map((ad) => ad.id));
    changed.dailyMetrics.forEach((row) => {
      if (
        !ids.has(row.entityId) ||
        row.date < data.scope.previous.start ||
        row.date > data.scope.current.end
      ) {
        row.spend *= 100;
        row.conversions *= 10;
        row.revenue *= 100;
      }
    });
    const isolated = collectAskData(
      workspace("cli_luxe", "7d", new InMemoryRepository(changed)),
    );
    for (const question of ASK_SUGGESTIONS)
      expect(answerQuestion(question, isolated)).toEqual(answerQuestion(question, data));
  });
  it("returns finite, serialized answers with correct vocabulary/currency across clients and presets", () => {
    for (const client of repository.listClients())
      for (const preset of ["7d", "14d", "30d", "today", "yesterday"] as const) {
        const facts = collectAskData(workspace(client.id, preset));
        for (const question of [
          ...ASK_SUGGESTIONS,
          "Why did CPA change?",
          "Why did ROAS fall?",
          "How concentrated is spend?",
          "Does the data prove fatigue?",
        ]) {
          const result = answerQuestion(question, facts);
          expect(result.answer.scope.currency).toBe(client.currency);
          expect(result.answer.scope.clientId).toBe(client.id);
          expect(JSON.parse(JSON.stringify(result.answer))).toEqual(result.answer);
          for (const metric of result.answer.metrics)
            expect(metric.value === null || Number.isFinite(metric.value)).toBe(true);
        }
        const comparison = answerQuestion(
          "What changed from the previous period?",
          facts,
        ).answer;
        expect(comparison.metrics[1].label).toBe(facts.facts.context.vocabulary.plural);
        if (!facts.facts.context.tracksRevenue)
          expect(answerQuestion("Why did ROAS fall?", facts).answer.state).toBe("insufficient");
        if (preset === "today" || preset === "yesterday")
          expect(answerQuestion("Why did CPA rise?", facts).answer.chart).toBeNull();
      }
  });
});

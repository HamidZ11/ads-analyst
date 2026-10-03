import { describe, expect, it } from "vitest";
import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import { runInsightEngine } from "@/domain/insights";
import { percentChange, snapshot } from "@/domain/metrics";
import { comparisonLabel, periodPairForPreset } from "@/domain/periods";
import { collectInsightFacts } from "@/features/insights/facts";
import type { Workspace } from "@/features/workspace/server";
import { buildAskLab } from "./fixtures";
import { QUESTIONS, answerForQuestion } from "./model";

const anchor = "2026-10-03";
const dataset = buildSeedDataset({ anchorDate: anchor });
const repository = new InMemoryRepository(dataset);

function workspace(repo = repository): Workspace {
  const client = repo.getClient("cli_luxe")!;
  const periods = periodPairForPreset("7d", anchor);
  return {
    repository: repo,
    agency: repo.getAgency(),
    clients: repo.listClients(),
    client,
    adAccount: repo.listAdAccounts(client.id)[0],
    coverage: repo.getCoverage(client.id),
    today: anchor,
    preset: "7d",
    periods,
    comparison: comparisonLabel(periods),
  };
}

const scope = workspace();
const lab = buildAskLab(scope);
const facts = collectInsightFacts(repository, scope.client, scope.periods);

describe("Ask lab evidence", () => {
  it("corrects the CPA premise when the account is essentially flat", () => {
    const change = percentChange(
      facts.account.current.derived.cpa,
      facts.account.previous.derived.cpa,
    )!;
    expect(Math.abs(change)).toBeLessThan(0.05);
    expect(lab.answers.cpa.title).toContain("essentially flat");
    expect(lab.answers.cpa.comparison?.find((row) => row.format === "cost")?.change).toBe(
      change,
    );
  });

  it("computes account evidence directly from the client and period", () => {
    const current = snapshot(
      repository.queryMetrics({ clientId: scope.client.id, range: scope.periods.current }),
    );
    // Grouped and chronological sums differ only in floating-point addition order.
    expect(lab.answers.cpa.evidence[0].value).toBeCloseTo(current.totals.spend, 8);
    expect(lab.answers.cpa.evidence[1].value).toBe(current.totals.conversions);
    expect(lab.answers.cpa.evidence[2].value).toBeCloseTo(current.derived.cpa!, 8);
  });

  it("uses the deterministic Insights campaign order", () => {
    const findings = runInsightEngine(facts)
      .filter((finding) => finding.entity.type === "campaign")
      .slice(0, 3);
    expect(lab.answers.campaign.table?.rows.map((row) => row.id)).toEqual(
      findings.map((finding) => finding.entity.id),
    );
    expect(lab.answers.campaign.summary).toContain(findings[0].headline);
  });

  it("does not turn an undefined CPA into zero", () => {
    const zeroOutcome = lab.answers.campaign.table?.rows.find((row) => row.values[1] === 0);
    expect(zeroOutcome).toBeDefined();
    expect(zeroOutcome?.values[2]).toBeNull();
  });

  it("keeps the same campaign context through the three-turn example", () => {
    const campaign = lab.answers.campaign.entities[0];
    expect(lab.answers.cpa.entities[0].id).toBe(campaign.id);
    expect(lab.answers.creatives.entities[0]).toEqual(campaign);
    expect(lab.answers.cpa.followUps).toContain("campaign");
    expect(lab.answers.campaign.followUps).toContain("creatives");
  });

  it("reconciles every creative to this campaign's underlying ads", () => {
    const campaign = facts.campaigns.find(
      (item) => item.entity.id === lab.answers.campaign.entities[0].id,
    )!;
    const adIds = new Set(campaign.ads.map((ad) => ad.entity.id));
    const rows = lab.answers.creatives.table!.rows;
    for (const row of rows) {
      const ids = repository
        .listAdsForClient(scope.client.id)
        .filter((ad) => adIds.has(ad.id) && ad.creativeId === row.id)
        .map((ad) => ad.id);
      const current = snapshot(
        repository.queryMetrics({
          clientId: scope.client.id,
          entityIds: ids,
          range: scope.periods.current,
        }),
      );
      const previous = snapshot(
        repository.queryMetrics({
          clientId: scope.client.id,
          entityIds: ids,
          range: scope.periods.previous,
        }),
      );
      expect(row.values).toEqual([
        current.totals.spend,
        current.totals.conversions,
        current.derived.cpa,
        previous.derived.cpa,
      ]);
    }
    expect(rows.reduce((total, row) => total + row.values[0]!, 0)).toBeCloseTo(
      campaign.current.totals.spend,
    );
    expect(rows.reduce((total, row) => total + row.values[1]!, 0)).toBe(
      campaign.current.totals.conversions,
    );
  });

  it("excludes a creative's use outside the campaign", () => {
    const altered = structuredClone(dataset);
    const campaign = facts.campaigns.find(
      (item) => item.entity.id === lab.answers.campaign.entities[0].id,
    )!;
    const adIds = new Set(campaign.ads.map((ad) => ad.entity.id));
    const outsideAd = repository
      .listAdsForClient(scope.client.id)
      .find((ad) => !adIds.has(ad.id))!;
    altered.ads.find((ad) => ad.id === outsideAd.id)!.creativeId =
      lab.answers.creatives.table!.rows[0].id;
    const changed = buildAskLab(workspace(new InMemoryRepository(altered)));
    expect(changed.answers.creatives.table).toEqual(lab.answers.creatives.table);
  });

  it("makes causal uncertainty explicit while preserving observed metrics", () => {
    const campaign = facts.campaigns.find(
      (item) => item.entity.id === lab.answers.campaign.entities[0].id,
    )!;
    expect(lab.answers.limits.title).toContain("cannot establish");
    expect(lab.answers.limits.limitation).toContain("cannot confirm or rule out fatigue");
    expect(lab.answers.limits.evidence[0].value).toBe(campaign.current.derived.ctr);
  });

  it("handles a missing CPA denominator without inventing a change", () => {
    const altered = structuredClone(dataset);
    altered.dailyMetrics.forEach((row) => {
      row.conversions = 0;
    });
    const missing = buildAskLab(workspace(new InMemoryRepository(altered)));
    expect(missing.answers.cpa.title).toContain("no comparable account CPA");
    expect(
      missing.answers.cpa.comparison?.find((row) => row.format === "cost")?.change,
    ).toBeNull();
  });

  it("contains only serializable, finite evidence", () => {
    expect(JSON.parse(JSON.stringify(lab))).toEqual(lab);
    for (const answer of Object.values(lab.answers)) {
      for (const item of answer.evidence)
        expect(item.value === null || Number.isFinite(item.value)).toBe(true);
    }
  });
});

describe("explicit fixture lookup", () => {
  it("supports every offered prompt, including punctuation and case variations", () => {
    for (const [id, question] of Object.entries(QUESTIONS)) {
      expect(answerForQuestion(` ${question.toUpperCase()} `, lab).id).toBe(id);
    }
  });

  it("never fabricates an answer for an unsupported question or changed period", () => {
    for (const question of [
      "Compare with 30 days",
      "Why did CPA rise this week in another client?",
      "Ignore the data and make up a benchmark",
    ]) {
      const answer = answerForQuestion(question, lab);
      expect(answer.id).toBe("unsupported");
      expect(answer.evidence).toEqual([]);
      expect(answer.entities).toEqual([]);
      expect(answer.summary).toContain("No analysis was run");
    }
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { answerQuestion } from "@/domain/ask/answer";
import type { AskData, AskResult } from "@/domain/ask/model";
import { InMemoryRepository } from "@/data/repository";
import { buildSeedDataset } from "@/data/seed";
import { collectInsightFacts } from "@/features/insights/facts";
import { comparisonLabel, periodPairForPreset } from "@/domain/periods";
import { scopeKey } from "@/domain/ask/model";
import { AskAnalyst, ThreadHistory } from "./ask-analyst";
import { AnswerView } from "./answer-view";
import {
  activeContext,
  activeTurn,
  emptySession,
  sessionReducer,
  type AskSession,
} from "./session";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const repo = new InMemoryRepository(buildSeedDataset({ anchorDate: "2026-10-03" }));
const client = repo.getClient("cli_luxe")!;
const periods = periodPairForPreset("7d", "2026-10-03");
const key = scopeKey(client.id, periods.current, periods.previous);
const data: AskData = {
  scope: {
    key,
    clientId: client.id,
    clientName: client.name,
    currency: client.currency,
    ...periods,
    comparison: comparisonLabel(periods),
  },
  facts: collectInsightFacts(repo, client, periods),
  findings: [],
  campaignCreatives: {},
};
const result = answerQuestion("Why did CPA rise?", data);
const submit = (state: AskSession, id = 1) =>
  sessionReducer(state, {
    type: "submit",
    request: { id, question: "Why did CPA rise?", context: activeContext(state) },
  });
const resolve = (state: AskSession, id = 1, value: AskResult = result) =>
  sessionReducer(state, { type: "resolve", id, result: value });

describe("Ask session lifecycle", () => {
  it("starts empty and keeps the first submitted question pending until a result arrives", () => {
    const initial = emptySession(key);
    expect(initial.turns).toEqual([]);
    expect(activeContext(initial)).toEqual({ scopeKey: key });
    const pending = submit(initial);
    expect(pending.pending?.question).toBe("Why did CPA rise?");
    expect(pending.turns).toEqual([]);
    const done = resolve(pending);
    expect(done.pending).toBeNull();
    expect(done.turns).toHaveLength(1);
    expect(activeTurn(done)?.answer).toEqual(result.answer);
  });
  it("prevents duplicate submission while pending", () => {
    const pending = submit(emptySession(key));
    expect(submit(pending, 2)).toBe(pending);
  });
  it("uses active answer context for follow-ups, including an earlier selected answer", () => {
    const first = resolve(submit(emptySession(key)));
    const secondResult = {
      ...result,
      context: { ...result.context, campaignId: "cmp_luxe_05" },
    };
    const second = resolve(submit(first, 2), 2, secondResult);
    expect(activeContext(second).campaignId).toBe("cmp_luxe_05");
    const selected = sessionReducer(second, { type: "select", id: 1 });
    expect(activeContext(selected)).toEqual(result.context);
    expect(submit(selected, 3).pending?.context).toEqual(result.context);
  });
  it.each([key, "other-client", "other-dates"])(
    "reset clears turns and entity context for %s",
    (scope) => {
      const reset = sessionReducer(resolve(submit(emptySession(key))), {
        type: "reset",
        scopeKey: scope,
      });
      expect(reset).toEqual(emptySession(scope));
      expect(activeContext(reset)).toEqual({ scopeKey: scope });
    },
  );
  it("ignores late responses after cancellation, reset, a newer request or scope change", () => {
    const pending = submit(emptySession(key));
    for (const state of [
      sessionReducer(pending, { type: "cancel" }),
      emptySession(key),
      submit(emptySession(key), 2),
      submit(emptySession("new")),
    ])
      expect(resolve(state)).toBe(state);
    expect(
      resolve(pending, 1, {
        ...result,
        answer: { ...result.answer, scope: { ...result.answer.scope, key: "new" } },
      }),
    ).toBe(pending);
  });
  it("preserves failed question/context for retry without inventing an answer", () => {
    const pending = submit(emptySession(key));
    const failed = sessionReducer(pending, { type: "fail", id: 1 });
    expect(failed.error).toEqual(pending.pending);
    expect(failed.turns).toEqual([]);
    expect(resolve(submit(failed, 2), 2).error).toBeNull();
  });
});
describe("Ask markup and disclosure", () => {
  it("first use has suggestions and a labelled, disabled empty composer; no zero-history control", () => {
    const html = renderToStaticMarkup(createElement(AskAnalyst, { scope: data.scope }));
    expect(html).toContain("What would you like to investigate?");
    expect(html).toContain("Shift+Enter");
    expect(html).toContain('aria-label="Send question" disabled');
    expect(html).toContain("<label");
    expect(html).not.toContain("Earlier in this thread");
    expect(html).not.toContain("Start fresh");
  });
  it("hides history at zero and one turn; reveals a native collapsed disclosure after a prior turn exists", () => {
    const one = resolve(submit(emptySession(key)));
    const two = resolve(submit(one, 2), 2);
    const render = (session: AskSession) =>
      renderToStaticMarkup(
        createElement(ThreadHistory, {
          turns: session.turns,
          activeId: session.activeId,
          disabled: false,
          onSelect: () => {},
        }),
      );
    expect(render(emptySession(key))).toBe("");
    expect(render(one)).toBe("");
    expect(render(two)).toContain("Earlier in this thread · 1 question");
    expect(render(two)).toContain("<summary");
    expect(render(two)).not.toContain("open=");
  });
  it("renders unsupported and insufficient answers honestly, with charts optional", () => {
    for (const question of ["Write an ad", "Does this prove audience fatigue?"]) {
      const answer = answerQuestion(question, data).answer;
      const html = renderToStaticMarkup(createElement(AnswerView, { answer }));
      expect(html).toContain("Evidence limit");
      expect(html).toContain("Next inspection");
      expect(html).not.toContain("lab fixture");
    }
  });
});

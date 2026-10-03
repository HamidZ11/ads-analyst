"use client";

import type { AskAnswer } from "@/domain/ask/model";
import type { Finding } from "@/domain/insights";
import type { CurrencyCode } from "@/domain/types";
import { AnswerView } from "@/features/ask/answer-view";
import { FindingDetail } from "@/features/insights/finding-detail";
import { InsightsWorkspace } from "@/features/insights/insights-workspace";
import type { InsightsModel } from "@/features/insights/insights-model";

/* Client boundaries for product components that use hooks. They render the
   shipped components unchanged; only the frame around them is new. */

export function FindingExhibit({
  finding,
  currency,
  currentLabel,
  previousLabel,
}: {
  finding: Finding;
  currency: CurrencyCode;
  currentLabel: string;
  previousLabel: string;
}) {
  return (
    <div className="p-6">
      <FindingDetail
        finding={finding}
        currency={currency}
        currentLabel={currentLabel}
        previousLabel={previousLabel}
      />
    </div>
  );
}

export function AnswerExhibit({ question, answer }: { question?: string; answer: AskAnswer }) {
  return (
    <div className="p-6">
      {/* The question bubble repeats Ask Analyst's markup; the answer is the shipped view. */}
      {question ? (
        <div className="mb-6 flex justify-end">
          <p className="max-w-[75%] rounded-lg border border-border/60 bg-surface-hover px-3 py-2 text-[13px] leading-5 text-ink">
            {question}
          </p>
        </div>
      ) : null}
      <AnswerView answer={answer} />
    </div>
  );
}

export function InsightsExhibit({ model }: { model: InsightsModel }) {
  return (
    <div className="p-6">
      <InsightsWorkspace model={model} />
    </div>
  );
}

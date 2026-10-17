"use client";

import type { Finding } from "@/domain/insights";
import type { CurrencyCode } from "@/domain/types";
import { FindingDetail } from "@/features/insights/finding-detail";
import { FindingRow, InsightsWorkspace } from "@/features/insights/insights-workspace";
import type { InsightsModel } from "@/features/insights/insights-model";

/* Client boundaries for product components that use hooks. They render the
   shipped components unchanged; only the frame around them is new. */

export function FindingExhibit({
  finding,
  currency,
  currentLabel,
  previousLabel,
  compact = false,
}: {
  finding: Finding;
  currency: CurrencyCode;
  currentLabel: string;
  previousLabel: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "p-5" : "p-6"}>
      <FindingDetail
        finding={finding}
        currency={currency}
        currentLabel={currentLabel}
        previousLabel={previousLabel}
        compact={compact}
      />
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

/**
 * A short excerpt of the Insights list: a title, the real counts, and chosen
 * rows rendered by the shipped `FindingRow` with their group rules. Rows are
 * not selected and do nothing; the exhibit is inert where it is shown.
 */
export function InsightsWeekExhibit({
  title,
  summary,
  findings,
  currency,
}: {
  title: string;
  summary: string;
  findings: Finding[];
  currency: CurrencyCode;
}) {
  return (
    <div className="p-4 sm:p-5">
      <p className="px-3 text-[15px] leading-6 font-semibold tracking-[-0.01em] text-ink">
        {title}
      </p>
      <p className="mt-0.5 px-3 text-sm leading-5 text-ink-muted">{summary}</p>
      <ul className="mt-3 border-t border-border pt-2">
        {findings.map((finding) => (
          <FindingRow
            key={finding.id}
            finding={finding}
            selected={false}
            desktop
            currency={currency}
            onSelect={() => {}}
          />
        ))}
      </ul>
    </div>
  );
}

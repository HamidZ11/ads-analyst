import { Dialog } from "radix-ui";
import { useId, type ReactNode } from "react";
import { Delta } from "@/components/ui/delta";
import {
  DETECTOR_LABELS,
  ENTITY_TYPE_LABELS,
  formatInsightValue,
  type EvidenceItem,
  type Finding,
} from "@/domain/insights";
import type { CurrencyCode } from "@/domain/types";
import { cn } from "@/lib/cn";
import { FindingChart } from "./finding-chart";
import { PriorityLabel } from "./priority";

/** Change colour follows the 5% materiality rule used by Campaigns and Creatives. */
export const INSIGHT_MATERIALITY = 0.05;

const EVIDENCE_COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

const NOTE_TONE = {
  positive: "font-medium text-positive",
  negative: "font-medium text-negative",
  muted: "text-ink-muted",
} as const;

function Evidence({ item, currency }: { item: EvidenceItem; currency: CurrencyCode }) {
  const hasChange = item.change !== undefined;
  return (
    <div className="min-w-0">
      <dt className="truncate text-xs text-ink-muted">{item.label}</dt>
      <dd className="mt-0.5 text-xl font-semibold tracking-[-0.01em] whitespace-nowrap text-ink tabular">
        {formatInsightValue(item.value, item.format, currency)}
      </dd>
      {hasChange || item.note ? (
        <dd className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted tabular">
          {hasChange ? (
            <Delta
              change={item.change ?? null}
              higherIsBetter={item.higherIsBetter ?? null}
              neutralBelow={INSIGHT_MATERIALITY}
            />
          ) : null}
          {item.note ? (
            <span className={NOTE_TONE[item.noteTone ?? "muted"]}>{item.note}</span>
          ) : null}
        </dd>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="mt-6 border-t border-border pt-4">
      <h3 id={id} className="text-xs font-medium text-ink-secondary">
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * One finding, top to bottom: priority and detector, the factual headline,
 * the entity, the evidence that proves it, a chart only where a trend is the
 * evidence, now / before / change, the suggested action, and why it was
 * flagged. Used inline on desktop and inside the sheet below 1280px.
 */
export function FindingDetail({
  finding,
  currency,
  currentLabel,
  previousLabel,
  inDialog = false,
  animate = false,
}: {
  finding: Finding;
  currency: CurrencyCode;
  currentLabel: string;
  previousLabel: string;
  /** Inside the sheet the headline and context become the dialog's title and description. */
  inDialog?: boolean;
  animate?: boolean;
}) {
  const titleId = useId();
  const { entity, evidence, chart, breakdown, comparison } = finding;
  const fmt = (value: number | null, format: Parameters<typeof formatInsightValue>[1]) =>
    formatInsightValue(value, format, currency);

  const context = (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      <PriorityLabel priority={finding.priority} />
      <span aria-hidden className="text-ink-faint">
        ·
      </span>
      <span className="text-ink-muted">{DETECTOR_LABELS[finding.detector]}</span>
    </p>
  );
  const heading = (
    <h2
      id={titleId}
      className="mt-2 text-[18px] leading-6 font-semibold tracking-[-0.02em] text-balance text-ink"
    >
      {finding.headline}
    </h2>
  );

  return (
    <article
      aria-labelledby={titleId}
      className={cn("min-w-0", animate && "animate-rise-in motion-reduce:animate-none")}
    >
      {inDialog ? <Dialog.Description asChild>{context}</Dialog.Description> : context}
      {inDialog ? <Dialog.Title asChild>{heading}</Dialog.Title> : heading}
      <p className="mt-1.5 text-xs leading-5 text-ink-muted">
        <span className="text-ink-faint">{ENTITY_TYPE_LABELS[entity.type]}</span>
        <span aria-hidden> · </span>
        <span className="font-medium break-words text-ink-secondary">{entity.name}</span>
        {entity.context ? <span> · {entity.context}</span> : null}
      </p>

      <dl
        className={cn(
          "mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-border pt-4",
          EVIDENCE_COLUMNS[Math.min(evidence.length, 4)],
        )}
      >
        {evidence.map((item) => (
          <Evidence key={item.label} item={item} currency={currency} />
        ))}
      </dl>

      {chart ? (
        <FindingChart
          chart={chart}
          currency={currency}
          currentLabel={currentLabel}
          previousLabel={previousLabel}
        />
      ) : null}

      {breakdown ? (
        <Section title={breakdown.title}>
          {finding.detector === "spend_concentration" && finding.key.value !== null ? (
            <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-accent-soft">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.min(100, finding.key.value * 100)}%` }}
              />
            </div>
          ) : null}
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[320px] border-collapse text-sm">
              <caption className="sr-only">{breakdown.title}</caption>
              <thead>
                <tr className="border-b border-border text-xs text-ink-muted">
                  <th scope="col" className="h-8 pr-3 text-left font-medium">
                    {entity.type === "ad" ? "Ad" : "Campaign"}
                  </th>
                  {breakdown.columns.map((column) => (
                    <th
                      key={column.label}
                      scope="col"
                      className="h-8 pl-3 text-right font-medium"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {breakdown.rows.map((row) => (
                  <tr key={row.id} className="border-b border-border last:border-b-0">
                    <th
                      scope="row"
                      className={cn(
                        "h-9 max-w-0 pr-3 text-left font-normal",
                        row.highlight ? "text-ink" : "text-ink-secondary",
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden
                          className={cn(
                            "size-1.5 shrink-0 rounded-full",
                            row.highlight ? "bg-accent" : "bg-transparent",
                          )}
                        />
                        <span
                          className={cn("truncate", row.highlight && "font-medium")}
                          title={row.label}
                        >
                          {row.highlight ? <span className="sr-only">Flagged: </span> : null}
                          {row.label}
                        </span>
                      </span>
                    </th>
                    {row.values.map((value, i) => (
                      <td
                        key={breakdown.columns[i].label}
                        className={cn(
                          "h-9 w-0 pl-3 text-right whitespace-nowrap tabular",
                          row.highlight ? "font-medium text-ink" : "text-ink-secondary",
                        )}
                      >
                        {fmt(value, breakdown.columns[i].format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {breakdown.note ? (
            <p className="mt-2 text-xs text-ink-muted">{breakdown.note}</p>
          ) : null}
        </Section>
      ) : null}

      {comparison.length > 0 ? (
        <Section title="Now against the previous period">
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[300px] border-collapse text-sm">
              <caption className="sr-only">
                {currentLabel} against {previousLabel}
              </caption>
              <thead>
                <tr className="border-b border-border text-xs text-ink-muted">
                  <th scope="col" className="h-8 pr-3 text-left font-medium">
                    Metric
                  </th>
                  <th scope="col" className="h-8 pl-3 text-right font-medium">
                    Now
                  </th>
                  <th scope="col" className="h-8 pl-3 text-right font-medium">
                    Before
                  </th>
                  <th scope="col" className="h-8 pl-3 text-right font-medium">
                    Change
                  </th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-b-0">
                    <th
                      scope="row"
                      className="h-9 pr-3 text-left font-normal text-ink-secondary"
                    >
                      {row.label}
                    </th>
                    <td className="h-9 pl-3 text-right font-medium whitespace-nowrap text-ink tabular">
                      {fmt(row.current, row.format)}
                    </td>
                    <td className="h-9 pl-3 text-right whitespace-nowrap text-ink-muted tabular">
                      {fmt(row.previous, row.format)}
                    </td>
                    <td className="h-9 pl-3 text-right whitespace-nowrap">
                      <Delta
                        change={row.change}
                        higherIsBetter={row.higherIsBetter}
                        neutralBelow={INSIGHT_MATERIALITY}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ) : null}

      <Section title="Suggested action">
        <p className="mt-1 text-sm leading-5 text-ink">{finding.action}</p>
      </Section>

      <section
        aria-label="Why this was flagged"
        className="mt-5 rounded-md bg-surface-subtle px-4 py-3"
      >
        <h3 className="text-xs font-medium text-ink-secondary">Why this was flagged</h3>
        <p className="mt-1 text-xs leading-5 text-ink-muted">{finding.reason}</p>
      </section>
    </article>
  );
}

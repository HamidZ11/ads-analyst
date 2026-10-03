import { ArrowRight, ChevronDown } from "lucide-react";
import { Delta } from "@/components/ui/delta";
import { ENTITY_TYPE_LABELS, formatInsightValue } from "@/domain/insights";
import type { CurrencyCode } from "@/domain/types";
import { CreativeArtwork } from "@/features/creatives/creative-artwork";
import { cn } from "@/lib/cn";
import { QUESTIONS, type AskLabModel, type LabAnswer, type QuestionId } from "./model";

export function Evidence({
  answer,
  currency,
  vertical = false,
}: {
  answer: LabAnswer;
  currency: CurrencyCode;
  vertical?: boolean;
}) {
  if (!answer.evidence.length) return null;
  return (
    <dl
      className={cn(
        "border-y border-border",
        vertical ? "divide-y divide-border" : "grid grid-cols-3 gap-6 py-4",
      )}
    >
      {answer.evidence.map((item) => (
        <div key={item.label} className={vertical ? "py-4" : undefined}>
          <dt className="text-xs text-ink-muted">{item.label}</dt>
          <dd className="mt-1 text-2xl font-semibold text-ink tabular">
            {formatInsightValue(item.value, item.format, currency)}
          </dd>
          <dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {item.change !== undefined && (
              <Delta
                change={item.change}
                higherIsBetter={item.higherIsBetter ?? null}
                neutralBelow={0.05}
              />
            )}
            {item.note && <span className="text-xs text-ink-muted tabular">{item.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Entities({ answer }: { answer: LabAnswer }) {
  if (!answer.entities.length) return null;
  return (
    <section className="mt-6">
      <h4 className="text-xs font-medium text-ink-secondary">Referenced entities</h4>
      <ul className="mt-2 space-y-3">
        {answer.entities.map((entity) => (
          <li key={entity.id}>
            <p className="text-xs text-ink-muted">{ENTITY_TYPE_LABELS[entity.type]}</p>
            <p className="mt-0.5 text-sm leading-5 text-ink">{entity.name}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AnswerIntro({ answer }: { answer: LabAnswer }) {
  return (
    <div>
      <h3 className="max-w-[65ch] text-xl leading-7 font-semibold text-ink">{answer.title}</h3>
      <p className="mt-2 max-w-[75ch] text-base leading-6 text-ink-secondary">
        {answer.summary}
      </p>
    </div>
  );
}

export function AnswerTable({ answer, lab }: { answer: LabAnswer; lab: AskLabModel }) {
  const format = (value: number | null, kind: Parameters<typeof formatInsightValue>[1]) =>
    formatInsightValue(value, kind, lab.currency);
  if (answer.comparison)
    return (
      <table className="mt-6 w-full text-sm">
        <caption className="pb-2 text-left text-xs font-medium text-ink-secondary">
          Account · current versus previous period
        </caption>
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted">
            <th scope="col" className="py-2 text-left font-normal">
              Metric
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Now
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Before
            </th>
            <th scope="col" className="py-2 text-right font-normal">
              Change
            </th>
          </tr>
        </thead>
        <tbody>
          {answer.comparison.map((row) => (
            <tr key={row.label} className="border-b border-border last:border-0">
              <th scope="row" className="py-2.5 text-left font-normal text-ink-secondary">
                {row.label}
              </th>
              <td className="py-2.5 text-right font-medium tabular">
                {format(row.current, row.format)}
              </td>
              <td className="py-2.5 text-right text-ink-muted tabular">
                {format(row.previous, row.format)}
              </td>
              <td className="py-2.5 text-right">
                <Delta
                  change={row.change}
                  higherIsBetter={row.higherIsBetter}
                  neutralBelow={0.05}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  const table = answer.table;
  if (!table) return null;
  return (
    <div className="mt-6">
      <table className="w-full table-fixed text-sm">
        <caption className="pb-2 text-left text-xs font-medium text-ink-secondary">
          {table.title}
        </caption>
        <thead>
          <tr className="border-b border-border text-xs text-ink-muted">
            <th scope="col" className="w-[42%] py-2 text-left font-normal">
              {table.identityLabel}
            </th>
            {table.columns.map((column) => (
              <th scope="col" key={column.label} className="py-2 text-right font-normal">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <th scope="row" className="py-3 pr-4 text-left font-normal">
                <span className="flex items-center gap-3">
                  {row.artwork && <CreativeArtwork {...row.artwork} width={40} height={48} />}
                  <span className="min-w-0">
                    <span className="block leading-5 font-medium text-ink">{row.name}</span>
                    <span className="mt-0.5 block text-xs text-ink-muted">{row.context}</span>
                  </span>
                </span>
              </th>
              {row.values.map((value, index) => (
                <td key={table.columns[index].label} className="py-3 text-right tabular">
                  {format(value, table.columns[index].format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs leading-5 text-ink-muted">{table.note}</p>
    </div>
  );
}

export function AnswerClose({
  answer,
  onAsk,
  disabled = false,
  showFollowUps = true,
}: {
  answer: LabAnswer;
  onAsk: (question: string) => void;
  disabled?: boolean;
  showFollowUps?: boolean;
}) {
  return (
    <>
      <section className="mt-5 border-t border-border pt-4">
        <p className="max-w-[75ch] text-sm leading-5 text-ink-muted">
          <span className="font-medium text-ink-secondary">
            {answer.id === "limits" ? "Missing evidence · " : "Evidence limit · "}
          </span>
          {answer.limitation}
        </p>
        <p className="mt-3 max-w-[75ch] text-sm leading-5 text-ink">
          <span className="font-medium">Next inspection · </span>
          {answer.next}
        </p>
      </section>
      <details className="group mt-4 text-xs text-ink-muted">
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm py-1 hover:text-ink">
          <ChevronDown
            size={13}
            aria-hidden
            className="transition-transform group-open:rotate-180"
          />
          How this answer was assembled
        </summary>
        <p className="mt-2 max-w-[80ch] leading-5">{answer.methodology}</p>
      </details>
      {showFollowUps && <FollowUps ids={answer.followUps} onAsk={onAsk} disabled={disabled} />}
    </>
  );
}

export function FollowUps({
  ids,
  onAsk,
  disabled = false,
}: {
  ids: QuestionId[];
  onAsk: (question: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1" aria-label="Follow-up questions">
      {ids.map((id) => (
        <button
          key={id}
          type="button"
          disabled={disabled}
          onClick={() => onAsk(QUESTIONS[id])}
          className="inline-flex items-center gap-2 rounded-sm py-2 text-sm font-medium text-accent hover:text-accent-strong disabled:cursor-not-allowed disabled:text-ink-muted"
        >
          {QUESTIONS[id]}
          <ArrowRight aria-hidden size={14} />
        </button>
      ))}
    </div>
  );
}

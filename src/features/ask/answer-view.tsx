import { ChevronDown } from "lucide-react";
import { Delta } from "@/components/ui/delta";
import type { AskAnswer } from "@/domain/ask/model";
import { formatDateRange } from "@/domain/format";
import { ENTITY_TYPE_LABELS, formatInsightValue } from "@/domain/insights";
import { FindingChart } from "@/features/insights/finding-chart";
import { cn } from "@/lib/cn";

export function AnswerView({ answer }: { answer: AskAnswer }) {
  const format = (value: number | null, kind: Parameters<typeof formatInsightValue>[1]) =>
    formatInsightValue(value, kind, answer.scope.currency);
  const table = answer.table;
  return (
    <article aria-label="Analytical answer" className="min-w-0 motion-safe:animate-rise-in">
      <h2 className="max-w-[65ch] text-xl leading-7 font-semibold text-ink">{answer.title}</h2>
      <p className="mt-2 max-w-[75ch] text-sm leading-6 text-ink-secondary sm:text-base">
        {answer.summary}
      </p>
      {answer.metrics.length > 0 && (
        <dl
          className={cn(
            "mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-y border-border py-4",
            answer.metrics.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3",
          )}
        >
          {answer.metrics.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs text-ink-muted">{item.label}</dt>
              <dd className="mt-1 text-xl font-semibold text-ink tabular sm:text-2xl">
                {format(item.value, item.format)}
              </dd>
              <dd className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                {item.change !== undefined && (
                  <Delta
                    change={item.change}
                    higherIsBetter={item.higherIsBetter ?? null}
                    neutralBelow={0.05}
                  />
                )}
                {item.note && (
                  <span
                    className={cn(
                      "text-xs text-ink-muted tabular",
                      item.noteTone === "positive" && "text-positive",
                      item.noteTone === "negative" && "text-negative",
                    )}
                  >
                    {item.note}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {table && (
        <section className="mt-6 min-w-0">
          <div
            role="region"
            aria-label={table.title}
            tabIndex={0}
            className="max-w-full overflow-x-auto rounded-sm"
          >
            <table className="w-full min-w-[560px] text-sm">
              <caption className="pb-2 text-left text-xs font-medium text-ink-secondary">
                {table.title}
              </caption>
              <thead>
                <tr className="border-b border-border text-xs text-ink-muted">
                  <th scope="col" className="w-[40%] py-2 pr-4 text-left font-normal">
                    Entity
                  </th>
                  {table.columns.map((column) => (
                    <th
                      key={column.label}
                      scope="col"
                      className="px-2 py-2 text-right font-normal"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row.entity.id} className="border-b border-border last:border-0">
                    <th scope="row" className="py-3 pr-4 text-left font-normal">
                      <span className="block leading-5 font-medium text-ink">
                        {row.entity.name}
                      </span>
                      <span className="mt-0.5 block text-xs text-ink-muted">
                        {row.entity.context ?? ENTITY_TYPE_LABELS[row.entity.type]}
                      </span>
                    </th>
                    {row.values.map((value, index) => (
                      <td
                        key={table.columns[index].label}
                        className="px-2 py-3 text-right whitespace-nowrap tabular"
                      >
                        {format(value, table.columns[index].format)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs leading-5 text-ink-muted">{table.note}</p>
        </section>
      )}
      {!table && answer.comparison.length > 0 && (
        <div
          role="region"
          aria-label="Period comparison"
          tabIndex={0}
          className="mt-6 max-w-full overflow-x-auto rounded-sm"
        >
          <table className="w-full min-w-[440px] text-sm">
            <caption className="pb-2 text-left text-xs font-medium text-ink-secondary">
              Current versus previous period
            </caption>
            <thead>
              <tr className="border-b border-border text-xs text-ink-muted">
                {["Metric", "Now", "Before", "Change"].map((label, i) => (
                  <th
                    key={label}
                    scope="col"
                    className={`py-2 font-normal ${i ? "text-right" : "text-left"}`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.comparison.map((row) => (
                <tr key={row.label} className="border-b border-border last:border-0">
                  <th
                    scope="row"
                    className="py-2.5 pr-4 text-left font-normal text-ink-secondary"
                  >
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
        </div>
      )}
      {answer.chart && (
        <FindingChart
          chart={answer.chart}
          currency={answer.scope.currency}
          currentLabel={formatDateRange(answer.scope.current)}
          previousLabel={formatDateRange(answer.scope.previous)}
        />
      )}
      {answer.entities.length > 0 && (
        <section className="mt-5">
          <h3 className="text-xs font-medium text-ink-secondary">Referenced entities</h3>
          <ul className="mt-2 space-y-1.5">
            {answer.entities.map((entity) => (
              <li key={entity.id} className="text-xs leading-5 text-ink-secondary">
                <span className="text-ink-muted">{ENTITY_TYPE_LABELS[entity.type]} · </span>
                {entity.name}
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="mt-5 border-t border-border pt-4">
        <p className="max-w-[75ch] text-sm leading-5 text-ink-muted">
          <span className="font-medium text-ink-secondary">Evidence limit · </span>
          {answer.evidenceLimit}
        </p>
        <p className="mt-3 max-w-[75ch] text-sm leading-5 text-ink">
          <span className="font-medium">Next inspection · </span>
          {answer.nextInspection}
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
        <p className="mt-2 leading-5">
          {answer.scope.clientName} · {formatDateRange(answer.scope.current)} compared with{" "}
          {formatDateRange(answer.scope.previous)}.
        </p>
        {answer.sources.length > 0 && (
          <p className="mt-2 text-[11px] leading-5 [overflow-wrap:anywhere]">
            Source references: {answer.sources.join(" · ")}
          </p>
        )}
      </details>
    </article>
  );
}

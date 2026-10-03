import type { ImportIssue } from "@/data/import";
import { cn } from "@/lib/cn";

function Samples({ issue }: { issue: ImportIssue }) {
  if (issue.samples.length === 0) return null;
  return (
    <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted tabular">
      {issue.samples.map((sample, i) => (
        <li key={`${sample.line}-${i}`}>
          Line {sample.line.toLocaleString("en-GB")}
          {sample.value !== undefined ? (
            <span className="text-ink-secondary">
              {" "}
              · {sample.value === "" ? "blank" : `“${sample.value.slice(0, 48)}”`}
            </span>
          ) : null}
        </li>
      ))}
      {issue.count > issue.samples.length ? (
        <li>and {(issue.count - issue.samples.length).toLocaleString("en-GB")} more</li>
      ) : null}
    </ul>
  );
}

/**
 * Blockers are genuine uncertainty: a filled `negative` dot, the words "Can't
 * import" and sample rows. Handled items are calm: a hollow dot, plain text,
 * no samples. Neither relies on colour alone.
 */
export function IssueList({
  issues,
  level,
  title,
}: {
  issues: ImportIssue[];
  level: ImportIssue["level"];
  title: string;
}) {
  const items = issues.filter((issue) => issue.level === level);
  if (items.length === 0) return null;
  const blocker = level === "error";
  return (
    <section aria-labelledby={`import-${level}s`} className="mt-6">
      <h3 id={`import-${level}s`} className="text-sm font-medium text-ink">
        {title}
      </h3>
      <ul
        className={cn(
          "mt-2",
          blocker ? "divide-y divide-border border-y border-border" : "space-y-1.5",
        )}
      >
        {items.map((issue) => (
          <li key={issue.code} className={cn("flex gap-2.5", blocker ? "py-3" : "")}>
            <span
              aria-hidden
              className={cn(
                "mt-[7px] size-1.5 shrink-0 rounded-full",
                blocker ? "bg-negative" : "border border-ink-faint",
              )}
            />
            <div className="min-w-0">
              <p
                className={cn(
                  "leading-5",
                  blocker ? "text-sm text-ink" : "text-sm text-ink-secondary",
                )}
              >
                {blocker ? <span className="sr-only">Can&apos;t import: </span> : null}
                {issue.message}
              </p>
              {blocker ? <Samples issue={issue} /> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

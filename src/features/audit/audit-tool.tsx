"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import { CSV_LIMITS } from "@/data/import";
import { todayInTimezone } from "@/domain/periods";
import m from "@/features/marketing/marketing.module.css";
import { auditMailto } from "@/features/marketing/hero";
import { cn } from "@/lib/cn";
import { auditExport, type AuditProblem, type AuditReport, type AuditTargets } from "./audit";
import s from "./audit.module.css";
import { AuditReportView } from "./audit-report";
import { SAMPLE_FILE_NAME, SAMPLE_PATH } from "./sample-path";

/**
 * The instant audit (D-083). The file is read with the File API and analysed
 * by `auditExport` in this tab; it is never sent, stored or logged. The only
 * request this component makes is a plain GET for the published sample
 * export when the visitor asks for it.
 */

type State =
  | { kind: "idle" }
  | { kind: "reading" }
  | { kind: "problem"; problem: AuditProblem; fileName: string }
  | { kind: "report"; report: AuditReport; bytes: Uint8Array; sample: boolean };

export const UNREADABLE_FILE: AuditProblem = {
  code: "unreadable_file",
  title: "This file couldn't be read",
  detail:
    "Your browser couldn't open it. If it was moved, renamed or is still downloading or syncing, choose it again from its folder, or export it again from Ads Manager.",
};

const SAMPLE_UNAVAILABLE: AuditProblem = {
  code: "sample_unavailable",
  title: "The sample export didn't load",
  detail: "Try again in a moment, or drop your own export here.",
};

function today() {
  return todayInTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
}

export function AuditTool({ guide, email }: { guide: ReactNode; email: string | null }) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);
  const audit = auditMailto(email);

  useEffect(() => {
    if (state.kind !== "report" && state.kind !== "problem") return;
    // Focus the report's heading, or the refusal, so the reader starts there.
    const target =
      state.kind === "report"
        ? document.getElementById("audit-title")
        : resultRef.current?.querySelector<HTMLElement>('[role="alert"]');
    target?.focus({ preventScroll: true });
    resultRef.current?.scrollIntoView({ block: "start" });
  }, [state.kind]);

  function run(
    bytes: Uint8Array,
    fileName: string,
    sample: boolean,
    outcomeColumn?: number,
    targets?: AuditTargets,
  ) {
    const result = auditExport({ bytes, fileName, today: today(), outcomeColumn, targets });
    setState(
      result.ok
        ? { kind: "report", report: result.report, bytes, sample }
        : { kind: "problem", problem: result.problem, fileName },
    );
  }

  async function readFile(file: File) {
    setState({ kind: "reading" });
    let bytes: Uint8Array;
    try {
      // One byte over the limit is enough for the reader to name the size problem.
      bytes = new Uint8Array(await file.slice(0, CSV_LIMITS.maxBytes + 1).arrayBuffer());
    } catch {
      // The browser couldn't read it: moved, deleted, or still syncing from cloud storage.
      setState({ kind: "problem", fileName: file.name, problem: UNREADABLE_FILE });
      return;
    }
    run(bytes, file.name, false);
  }

  async function readSample() {
    setState({ kind: "reading" });
    let bytes: Uint8Array | null = null;
    try {
      const response = await fetch(SAMPLE_PATH);
      if (response.ok) bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      // Offline or interrupted: the same refusal as a failed response.
    }
    if (!bytes) {
      setState({ kind: "problem", fileName: SAMPLE_FILE_NAME, problem: SAMPLE_UNAVAILABLE });
      return;
    }
    run(bytes, SAMPLE_FILE_NAME, true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const picked = event.dataTransfer.files[0];
    if (picked) void readFile(picked);
  }

  return (
    <>
      <div className={s.intake}>
        <div className={cn(s.panel, s.uploadPanel, "font-sans text-ink")}>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            aria-busy={state.kind === "reading" || undefined}
            className={cn(
              "flex flex-col items-start gap-4 rounded-lg border border-dashed px-5 py-8 transition-colors sm:px-6",
              dragging
                ? "border-accent bg-accent-soft/40"
                : "border-border-strong bg-surface-subtle",
            )}
          >
            <div>
              <p className="text-base font-semibold tracking-[-0.01em] text-ink">
                Drop a Meta Ads Manager CSV here
              </p>
              <p className="mt-1 text-sm leading-5 text-ink-muted">
                Ad level, by day, at least 14 days ·{" "}
                <span className="whitespace-nowrap">up to 10 MB</span>
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <label
                htmlFor="audit-file"
                className="inline-flex h-9 cursor-pointer items-center rounded-md border border-accent bg-accent px-3.5 text-sm font-medium text-white transition-colors hover:border-accent-strong hover:bg-accent-strong has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent"
              >
                Choose file
                <input
                  id="audit-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) void readFile(picked);
                    e.target.value = "";
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => void readSample()}
                className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-3.5 text-sm font-medium text-ink transition-[color,background-color,border-color] hover:bg-surface-hover"
              >
                Try the sample export
              </button>
            </div>
          </div>
          <p className="mt-4 text-sm leading-5 text-ink-secondary">
            Your file is read in this browser tab. It isn’t uploaded, stored or shared, and
            closing the tab clears it.
          </p>
          <p className="mt-1.5 text-xs leading-5 text-ink-muted">
            The sample is generated from the demo’s fictional Luxe Skin Co. account.{" "}
            <a
              href={SAMPLE_PATH}
              download={SAMPLE_FILE_NAME}
              className="font-medium text-ink-secondary underline decoration-border-strong underline-offset-2 hover:text-ink"
            >
              Download the sample
            </a>{" "}
            to see the format.
          </p>
        </div>
        {guide}
      </div>

      <p role="status" className="sr-only">
        {state.kind === "reading"
          ? "Reading the export"
          : state.kind === "report"
            ? `Audit ready: ${state.report.findings.length} ${state.report.findings.length === 1 ? "finding" : "findings"}.`
            : ""}
      </p>
      <div ref={resultRef} className={s.result}>
        {state.kind === "reading" ? (
          <p aria-hidden className={cn(s.reading, "font-sans")}>
            Reading the export…
          </p>
        ) : null}
        {state.kind === "problem" ? (
          <div
            role="alert"
            tabIndex={-1}
            className={cn(s.panel, s.problemPanel, "font-sans text-ink")}
          >
            <p className="text-xs text-ink-muted">{state.fileName}</p>
            <h2 className="mt-1 text-[18px] leading-6 font-semibold tracking-[-0.02em]">
              {state.problem.title}
            </h2>
            <p className="mt-1.5 max-w-[68ch] text-sm leading-6 text-ink-secondary">
              {state.problem.detail}
            </p>
            {state.problem.issues?.length ? (
              <ul className="mt-4 space-y-3 border-t border-border pt-4">
                {state.problem.issues.map((issue) => (
                  <li key={issue.code} className="flex gap-2.5 text-sm leading-5">
                    <span
                      aria-hidden
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-negative"
                    />
                    <span>
                      <span className="text-ink">{issue.message}</span>
                      {issue.samples.length ? (
                        <span className="mt-0.5 block text-xs text-ink-muted tabular">
                          {issue.samples
                            .map((x) =>
                              x.value ? `Line ${x.line}: ${x.value}` : `Line ${x.line}`,
                            )
                            .join(" · ")}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {state.kind === "report" ? (
          <>
            <AuditReportView
              report={state.report}
              sample={state.sample}
              onReset={() => {
                setState({ kind: "idle" });
                document.getElementById("audit-file")?.focus();
              }}
              onOutcome={(column) =>
                run(
                  state.bytes,
                  state.report.fileName,
                  state.sample,
                  column,
                  state.report.targets,
                )
              }
              onTargets={(targets) =>
                run(
                  state.bytes,
                  state.report.fileName,
                  state.sample,
                  state.report.outcome.column,
                  targets,
                )
              }
            />
            <section className={cn(m.cta, s.next)} aria-labelledby="audit-next-title">
              <h2 id="audit-next-title" className={m.ctaTitle}>
                Start tracking every client account.
              </h2>
              <p className={m.ctaLine}>
                Import each client’s export into Ad Analyst and these checks run against that
                client’s own cost and ROAS targets, beside the Overview, Campaigns and
                Creatives.
              </p>
              <div className={cn(m.actions, m.ctaActions)}>
                <Link href="/sign-in" className={m.button}>
                  Start tracking your clients
                </Link>
                <Link href="/pricing" className={m.textLink}>
                  See pricing
                  <ArrowRight aria-hidden size={16} strokeWidth={1.75} />
                </Link>
              </div>
              {audit ? (
                <p className={s.emailAudit}>
                  Rather have a person look at your accounts?{" "}
                  <a href={audit}>Request an audit by email</a>.
                </p>
              ) : null}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}

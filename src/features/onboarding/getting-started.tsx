import { Check } from "lucide-react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";
import { formatCurrency, formatDateRange, formatMultiple, formatNumber } from "@/domain/format";
import { CLIENT_TYPE_LABELS, conversionVocabulary, tracksRevenue } from "@/domain/labels";
import { cn } from "@/lib/cn";
import { EXPORT_NOTE, EXPORT_STEPS } from "./export-steps";
import type { OnboardingProgress, OnboardingStep, OnboardingStepId } from "./progress";

export const FIRST_IMPORT_HREF = "/clients/import?client=new";
export const TARGETS_HREF = "/settings#settings-targets";

const TITLES: Record<OnboardingStepId, string> = {
  client: "Add your first client",
  import: "Import a Meta Ads CSV",
  findings: "See your first findings",
  targets: "Set targets",
};

interface StepContent {
  title: string;
  /** What to do, shown while the step is current. */
  description: string;
  /** What the workspace holds, shown once the step is done. */
  detail: string | null;
  action: { label: string; href: string } | null;
}

/** The words for one step, built only from what the workspace holds. */
export function stepContent(step: OnboardingStep, progress: OnboardingProgress): StepContent {
  const { client, latestImport, coverage } = progress;
  const title = TITLES[step.id];
  switch (step.id) {
    case "client":
      return {
        title,
        description:
          "A client is created from its first Meta Ads export. While importing you name it and confirm its business type, timezone and currency.",
        detail: client
          ? `${client.name} · ${CLIENT_TYPE_LABELS[client.type]} · ${client.currency}`
          : null,
        action: { label: "Import a Meta Ads export", href: FIRST_IMPORT_HREF },
      };
    case "import":
      return {
        title,
        description:
          "Export the client’s ads with a daily breakdown from Ads Manager, then upload the file. The columns are matched for you.",
        detail: latestImport
          ? `${latestImport.fileName} · ${formatDateRange({ start: latestImport.firstDate, end: latestImport.lastDate })} · ${formatNumber(latestImport.rows)} rows`
          : null,
        action: { label: "Import a Meta Ads export", href: FIRST_IMPORT_HREF },
      };
    case "findings":
      return {
        title,
        description:
          "Insights checks the imported days for spend without conversions, cost and ROAS changes, creative fatigue and campaigns worth scaling.",
        detail:
          client && coverage
            ? `${formatNumber(coverage.days)} ${coverage.days === 1 ? "day" : "days"} of ${client.name} in Insights`
            : null,
        action: { label: "Open Insights", href: "/insights" },
      };
    case "targets": {
      const cost = client
        ? conversionVocabulary(client.type).costLabel.toLowerCase()
        : "cost per conversion";
      const set = client
        ? [
            client.targetCpa !== null
              ? `CPA ${formatCurrency(client.targetCpa, client.currency)}`
              : null,
            client.targetRoas !== null ? `ROAS ${formatMultiple(client.targetRoas, 1)}` : null,
          ].filter(Boolean)
        : [];
      const roas = !client || tracksRevenue(client) ? " or ROAS" : "";
      return {
        title,
        description: `Optional. Add a ${cost}${roas} target${client ? ` for ${client.name}` : ""} and every number and finding is measured against it.`,
        detail: client && set.length ? `${set.join(" · ")} for ${client.name}` : null,
        action: { label: "Set targets", href: TARGETS_HREF },
      };
    }
  }
}

/** How to export from Ads Manager, as a disclosure under the current step. */
export function ExportGuide({ open = false }: { open?: boolean }) {
  return (
    <details open={open} className="group mt-4 max-w-[600px]">
      <summary className="cursor-pointer text-[13px] font-medium text-ink-secondary marker:text-ink-faint hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
        How to export from Ads Manager
      </summary>
      <ol className="mt-3 space-y-2.5 border-l border-border pl-4">
        {EXPORT_STEPS.map((step, index) => (
          <li key={step.title} className="text-xs leading-5">
            <span className="font-medium text-ink">
              <span className="text-ink-faint tabular">{index + 1}.</span> {step.title}
            </span>
            <span className="block text-ink-muted">{step.body}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 pl-4 text-xs text-ink-faint">{EXPORT_NOTE}</p>
    </details>
  );
}

function StepMarker({ step, index }: { step: OnboardingStep; index: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular",
        step.status === "current"
          ? "bg-ink text-surface"
          : step.status === "done"
            ? "bg-surface-active text-ink-secondary"
            : "border border-border text-ink-faint",
      )}
    >
      {step.status === "done" ? <Check size={12} strokeWidth={2.25} /> : index + 1}
    </span>
  );
}

/**
 * The first-run checklist: add a client, import, see findings, set targets.
 * Progress comes from the workspace itself; the current step carries the one
 * primary action (DESIGN.md §29).
 */
export function GettingStarted({ progress }: { progress: OnboardingProgress }) {
  const total = progress.steps.length;
  return (
    <section aria-labelledby="getting-started" className="max-w-[720px]">
      <div className="flex items-baseline justify-between gap-4 border-b border-border pb-3">
        <h2
          id="getting-started"
          className="text-base font-semibold tracking-[-0.01em] text-ink"
        >
          Get started
        </h2>
        <p className="text-xs text-ink-muted tabular">
          {progress.done} of {total} done
        </p>
      </div>
      <ol>
        {progress.steps.map((step, index) => {
          const content = stepContent(step, progress);
          const current = step.status === "current";
          return (
            <li
              key={step.id}
              aria-current={current ? "step" : undefined}
              className="grid grid-cols-[20px_minmax(0,1fr)] gap-x-3 border-b border-border py-4"
            >
              <StepMarker step={step} index={index} />
              <div className="min-w-0">
                <p
                  className={cn(
                    "leading-5",
                    current
                      ? "text-sm font-semibold text-ink"
                      : step.status === "done"
                        ? "text-sm font-medium text-ink-secondary"
                        : "text-sm font-medium text-ink-muted",
                  )}
                >
                  {content.title}
                  {step.optional && !current ? (
                    <span className="font-normal text-ink-faint"> · optional</span>
                  ) : null}
                  {step.status === "done" ? <span className="sr-only"> (done)</span> : null}
                </p>
                {step.status === "done" && content.detail ? (
                  <p
                    className="mt-0.5 truncate text-xs text-ink-muted tabular"
                    title={content.detail}
                  >
                    {content.detail}
                  </p>
                ) : null}
                {current ? (
                  <>
                    <p className="mt-1 max-w-[60ch] text-[13px] leading-5 text-ink-muted">
                      {content.description}
                    </p>
                    {content.action ? (
                      <Link
                        href={content.action.href}
                        className={buttonClasses("primary", "md", "mt-3")}
                      >
                        {content.action.label}
                      </Link>
                    ) : null}
                    {step.id === "client" || step.id === "import" ? <ExportGuide open /> : null}
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/**
 * Once findings can be read and only the optional targets remain: one quiet
 * line with a text link, never a second checklist.
 */
export function TargetsNudge({
  progress,
  className,
}: {
  progress: OnboardingProgress;
  className?: string;
}) {
  const targets = progress.steps.find((s) => s.id === "targets");
  if (!progress.ready || !targets || targets.status === "done" || !progress.client) return null;
  const { description } = stepContent(targets, progress);
  return (
    <p className={cn("text-xs leading-5 text-ink-muted", className)}>
      <span className="font-medium text-ink-secondary">Next, optional:</span>{" "}
      {description.replace(/^Optional\. /, "")}{" "}
      <Link
        href={TARGETS_HREF}
        className="font-medium whitespace-nowrap text-accent-strong underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        Set targets
      </Link>
    </p>
  );
}

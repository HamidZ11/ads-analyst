"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import type { CurrencyCode } from "@/domain/types";
import { readTargets } from "@/features/import/targets";
import type { AuditTargets } from "./audit";

const INPUT =
  "mt-1 h-8 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink tabular transition-colors placeholder:text-ink-faint hover:border-border-strong focus-visible:border-accent-border focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent disabled:cursor-not-allowed disabled:bg-surface-subtle";

/** Blank is no target; anything else must be a number, which `readTargets` then checks. */
const toNumber = (raw: string) => (raw.trim() === "" ? null : Number(raw));

/**
 * Optional targets for the audit, validated exactly as Settings validates a
 * client's targets. Applying re-runs the rules over the same file in this tab.
 */
export function AuditTargetsForm({
  currency,
  revenueTracked,
  targets,
  onApply,
}: {
  currency: CurrencyCode;
  revenueTracked: boolean;
  targets: AuditTargets;
  onApply: (targets: AuditTargets) => void;
}) {
  const id = useId();
  const [cpa, setCpa] = useState(targets.targetCpa?.toString() ?? "");
  const [roas, setRoas] = useState(targets.targetRoas?.toString() ?? "");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = targets.targetCpa !== null || targets.targetRoas !== null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const read = readTargets(
      { targetCpa: toNumber(cpa), targetRoas: revenueTracked ? toNumber(roas) : null },
      revenueTracked,
    );
    if (!read.ok) {
      setMessage({ ok: false, text: read.message });
      return;
    }
    onApply({ targetCpa: read.targetCpa, targetRoas: read.targetRoas });
    setMessage({
      ok: true,
      text:
        read.targetCpa === null && read.targetRoas === null
          ? "Targets cleared. The findings below are updated."
          : "Targets applied. The findings below are updated.",
    });
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,180px)_auto] sm:items-end"
    >
      <div>
        <label htmlFor={`${id}-cpa`} className="text-xs font-medium text-ink-muted">
          Target CPA ({currency})
        </label>
        <input
          id={`${id}-cpa`}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={cpa}
          onChange={(e) => setCpa(e.target.value)}
          placeholder="Not set"
          aria-invalid={
            message?.ok === false && message.text.includes("CPA") ? true : undefined
          }
          aria-describedby={`${id}-message`}
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor={`${id}-roas`} className="text-xs font-medium text-ink-muted">
          Target ROAS
        </label>
        <input
          id={`${id}-roas`}
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={revenueTracked ? roas : ""}
          onChange={(e) => setRoas(e.target.value)}
          placeholder={revenueTracked ? "Not set" : "Needs conversion value"}
          disabled={!revenueTracked}
          aria-invalid={
            message?.ok === false && message.text.includes("ROAS") ? true : undefined
          }
          aria-describedby={`${id}-message`}
          className={INPUT}
        />
      </div>
      <Button type="submit" className="justify-self-start">
        {set ? "Update targets" : "Apply targets"}
      </Button>
      <p
        id={`${id}-message`}
        role="status"
        className={`text-xs sm:col-span-3 ${message?.ok === false ? "text-negative" : "text-ink-muted"}`}
      >
        {message?.text ??
          (revenueTracked
            ? null
            : "This file has no conversion value for these conversions, so ROAS is not tracked.")}
      </p>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { buttonClasses } from "@/components/ui/button";
import type { CurrencyCode } from "@/domain/types";
import { saveClientTargets, type TargetFormState } from "./actions";

const INPUT =
  "mt-1 h-8 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink tabular transition-colors hover:border-border-strong";

/** Optional targets for an imported client; blank clears a target. */
export function TargetForm({
  clientId,
  currency,
  targetCpa,
  targetRoas,
  revenueTracked,
}: {
  clientId: string;
  currency: CurrencyCode;
  targetCpa: number | null;
  targetRoas: number | null;
  revenueTracked: boolean;
}) {
  const [state, action, pending] = useActionState<TargetFormState, FormData>(
    saveClientTargets.bind(null, clientId),
    { ok: false, message: null },
  );
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <div>
        <label htmlFor="target-cpa" className="text-xs font-medium text-ink-muted">
          Target CPA ({currency})
        </label>
        <input
          id="target-cpa"
          name="targetCpa"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          defaultValue={targetCpa ?? ""}
          placeholder="Not set"
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor="target-roas" className="text-xs font-medium text-ink-muted">
          Target ROAS
        </label>
        <input
          id="target-roas"
          name="targetRoas"
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          defaultValue={targetRoas ?? ""}
          placeholder={revenueTracked ? "Not set" : "Needs conversion value"}
          disabled={!revenueTracked}
          aria-describedby={revenueTracked ? undefined : "target-roas-hint"}
          className={INPUT}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={buttonClasses("secondary", "md", pending ? "opacity-70" : undefined)}
      >
        {pending ? "Saving…" : "Save targets"}
      </button>
      {!revenueTracked ? (
        <p id="target-roas-hint" className="text-xs text-ink-muted sm:col-span-3">
          This client&apos;s imports do not include conversion value, so ROAS is not tracked.
        </p>
      ) : null}
      <p
        role="status"
        className={`text-xs sm:col-span-3 ${state.ok ? "text-ink-muted" : "text-negative"}`}
      >
        {state.message}
      </p>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { saveReportNote, type NoteFormState } from "./actions";
import { NOTE_MAX_LENGTH } from "./note";

/**
 * "What we're doing next": the one part of the report the agency writes. On
 * screen it is a form; on paper only the text prints, and an empty note
 * leaves the section out. In the demo it can be edited and printed but is
 * never stored.
 */
export function NotesEditor({
  clientId,
  periodStart,
  periodEnd,
  initial,
  suggestion,
  canSave,
}: {
  clientId: string;
  periodStart: string;
  periodEnd: string;
  initial: string;
  suggestion: string;
  canSave: boolean;
}) {
  const [text, setText] = useState(initial);
  const [state, action, pending] = useActionState<NoteFormState, FormData>(
    saveReportNote.bind(null, clientId, periodStart, periodEnd),
    { ok: false, message: null },
  );
  const empty = text.trim() === "";

  return (
    <section
      aria-labelledby="report-next"
      className={cn(
        "border-t border-border pt-6 pb-8 print:pt-5 print:pb-6",
        empty && "print:hidden",
      )}
    >
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="report-next" className="text-base font-semibold tracking-[-0.01em] text-ink">
          What we&apos;re doing next
        </h2>
        <p className="text-xs text-ink-muted print:hidden">
          {canSave
            ? "Written by you, saved for this client and period"
            : "Demo: you can edit and print this, but it isn't saved"}
        </p>
      </div>

      <p className="hidden text-sm leading-6 whitespace-pre-wrap text-ink-secondary print:block">
        {text.trim()}
      </p>

      <form action={action} className="print:hidden">
        <label htmlFor="report-note" className="sr-only">
          What we&apos;re doing next
        </label>
        <textarea
          id="report-note"
          name="note"
          rows={6}
          maxLength={NOTE_MAX_LENGTH}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="The changes you are making next, in your own words. This is the only part of the report you write."
          className="block w-full resize-y rounded-md border border-border bg-surface px-3 py-2 text-sm leading-6 text-ink transition-[color,background-color,border-color] placeholder:text-ink-faint hover:border-border-strong focus-visible:border-accent-border focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent"
          aria-describedby="report-note-status"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canSave ? (
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className={buttonClasses("secondary", "md", pending ? "opacity-70" : undefined)}
            >
              {pending ? "Saving…" : "Save note"}
            </button>
          ) : null}
          {empty && suggestion ? (
            <button
              type="button"
              onClick={() => setText(suggestion)}
              className={buttonClasses("ghost")}
            >
              Start from the suggested actions
            </button>
          ) : null}
          <p
            id="report-note-status"
            role="status"
            className={cn("text-xs", state.ok ? "text-ink-muted" : "text-negative")}
          >
            {state.message}
          </p>
        </div>
      </form>
    </section>
  );
}

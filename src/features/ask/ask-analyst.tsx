"use client";

import { ArrowRight, CornerDownLeft } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export interface AskAnalystProps {
  clientName: string;
  rangeLabel: string;
  comparison: string;
  suggestions: readonly string[];
}

export function AskAnalyst({
  clientName,
  rangeLabel,
  comparison,
  suggestions,
}: AskAnalystProps) {
  const inputId = useId();
  const [question, setQuestion] = useState("");
  const [submitted, setSubmitted] = useState<string | null>(null);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    setSubmitted(trimmed);
  };

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody className="pt-4">
          <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor={inputId} className="sr-only">
              Ask a question about {clientName}
            </label>
            <Input
              id={inputId}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={`Ask about ${clientName}…`}
              autoComplete="off"
              leading={<CornerDownLeft size={14} />}
              className="flex-1"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={question.trim() === ""}
              className="sm:w-auto"
            >
              Ask
              <ArrowRight aria-hidden size={14} />
            </Button>
          </form>
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            <span className="font-medium text-ink-secondary">Scope</span>
            <span className="rounded-sm bg-surface-active px-1.5 py-0.5 text-ink-secondary">
              {clientName}
            </span>
            <span className="rounded-sm bg-surface-active px-1.5 py-0.5 text-ink-secondary">
              {rangeLabel} vs {comparison}
            </span>
            <span className="rounded-sm bg-surface-active px-1.5 py-0.5 text-ink-secondary">
              Meta Ads
            </span>
          </p>
        </CardBody>
      </Card>

      <div role="status" aria-live="polite">
        {submitted ? (
          <Card
            key={submitted}
            className="border-accent-border bg-accent-soft/40 motion-safe:animate-rise-in"
          >
            <CardBody className="pt-3.5">
              <p className="text-sm font-medium text-ink">“{submitted}”</p>
              <p className="mt-1 text-xs text-ink-secondary">
                Ask Analyst is not connected in this release. When it is, this question will be
                answered from {clientName}&apos;s data for {rangeLabel.toLowerCase()}, with
                every figure traced to the campaign, ad set or creative it came from.
              </p>
            </CardBody>
          </Card>
        ) : null}
      </div>

      <section aria-labelledby="suggested-heading">
        <h2 id="suggested-heading" className="mb-2 text-sm font-semibold text-ink">
          Suggested questions
        </h2>
        <ul className="flex flex-col gap-1.5">
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => {
                  setQuestion(suggestion);
                  setSubmitted(null);
                }}
                className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-left text-sm text-ink transition-colors hover:border-border-strong hover:bg-surface-hover"
              >
                <span>{suggestion}</span>
                <ArrowRight aria-hidden size={14} className="shrink-0 text-ink-faint" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-heading" className="grid gap-3 sm:grid-cols-3">
        <h2 id="how-heading" className="sr-only">
          How answers will work
        </h2>
        {[
          [
            "Grounded in your data",
            "Every answer is computed from the selected client's daily metrics, never from general knowledge.",
          ],
          [
            "Shows its working",
            "Answers cite the metrics, periods and comparisons used so the reasoning can be checked.",
          ],
          [
            "Links to the source",
            "Each finding points to the campaign, ad set or creative it came from.",
          ],
        ].map(([title, body]) => (
          <div
            key={title}
            className="rounded-lg border border-border bg-surface-subtle px-3.5 py-3"
          >
            <h3 className="text-xs font-semibold text-ink">{title}</h3>
            <p className="mt-1 text-xs text-ink-muted">{body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

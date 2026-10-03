"use client";

import { ArrowRight, ArrowUp, ChevronDown, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useLayoutEffect, useReducer, useRef, useState } from "react";
import {
  ASK_MAX_QUESTION_LENGTH,
  ASK_SUGGESTIONS,
  type AskContext,
  type AskResult,
  type AskScope,
} from "@/domain/ask/model";
import { formatDateRange } from "@/domain/format";
import { AnswerView } from "./answer-view";
import {
  activeContext,
  activeTurn,
  emptySession,
  sessionReducer,
  type AskTurn,
} from "./session";

export function ThreadHistory({
  turns,
  activeId,
  disabled,
  onSelect,
}: {
  turns: AskTurn[];
  activeId: number | null;
  disabled: boolean;
  onSelect: (id: number) => void;
}) {
  const previous = turns.filter((turn) => turn.id !== activeId);
  if (!previous.length) return null;
  return (
    <details className="group min-w-0 flex-1 text-xs text-ink-muted">
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-sm py-2 hover:text-ink">
        <ChevronDown
          size={13}
          aria-hidden
          className="transition-transform group-open:rotate-180"
        />
        Earlier in this thread · {previous.length}{" "}
        {previous.length === 1 ? "question" : "questions"}
      </summary>
      <ul className="max-h-32 overflow-y-auto pb-2">
        {previous.map((turn) => (
          <li key={turn.id}>
            <button
              type="button"
              disabled={disabled}
              onClick={(event) => {
                onSelect(turn.id);
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
              className="w-full rounded-sm px-1 py-2 text-left leading-5 hover:bg-surface-hover hover:text-ink disabled:opacity-50"
            >
              {turn.question}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function AskAnalyst({ scope }: { scope: AskScope }) {
  const router = useRouter();
  const [session, dispatch] = useReducer(sessionReducer, scope.key, emptySession);
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const inputId = useId();
  const helpId = useId();
  const active = activeTurn(session);
  const question = session.pending?.question ?? session.error?.question ?? active?.question;
  const busy = Boolean(session.pending);
  const answered = active && !session.pending && !session.error;
  const focusComposer = () => input.current?.focus({ preventScroll: true });

  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  useLayoutEffect(() => {
    const element = input.current;
    if (!element) return;
    element.style.height = "auto";
    const line = Number.parseFloat(getComputedStyle(element).lineHeight);
    element.style.height = `${Math.min(element.scrollHeight, line * 2)}px`;
  }, [draft]);
  useLayoutEffect(() => {
    scroll.current?.scrollTo({ top: 0 });
  }, [session.pending?.id, session.activeId, session.error?.id]);

  const reset = () => {
    request.current?.abort();
    request.current = null;
    dispatch({ type: "reset", scopeKey: scope.key });
    setDraft("");
    setNotice("Thread cleared.");
    focusComposer();
  };
  const cancel = () => {
    request.current?.abort();
    request.current = null;
    setDraft((typed) => (typed.trim() ? typed : (session.pending?.question ?? "")));
    dispatch({ type: "cancel" });
    setNotice("Analysis cancelled.");
    focusComposer();
  };
  const ask = async (text: string, context: AskContext = activeContext(session)) => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > ASK_MAX_QUESTION_LENGTH || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    const id = ++sequence.current;
    dispatch({ type: "submit", request: { id, question: trimmed, context } });
    setDraft("");
    setNotice("");
    focusComposer();
    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, scopeKey: scope.key, context }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      if (response.status === 409) {
        dispatch({ type: "reset", scopeKey: scope.key });
        setNotice("The client or date range changed. The thread has been cleared.");
        router.refresh();
        return;
      }
      if (!response.ok) throw new Error("Analysis unavailable");
      const result = (await response.json()) as AskResult;
      if (controller.signal.aborted) return;
      if (result.answer?.scope?.key !== scope.key || result.context?.scopeKey !== scope.key)
        throw new Error("Scope mismatch");
      dispatch({ type: "resolve", id, result });
      setNotice("Answer ready.");
    } catch {
      if (!controller.signal.aborted) dispatch({ type: "fail", id });
    } finally {
      if (request.current === controller) request.current = null;
    }
  };

  return (
    <section
      aria-label="Ask Analyst workspace"
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div className="shrink-0 border-b border-border pb-3 text-xs leading-5 text-ink-muted">
        <span className="font-medium text-ink-secondary">{scope.clientName}</span>
        <span>
          {" "}
          · {formatDateRange(scope.current)} · vs {formatDateRange(scope.previous)}
        </span>
        <span className="mt-0.5 block text-[11px]">
          Deterministic analysis · selected client only · changing scope clears this thread
        </span>
      </div>
      {(session.turns.length > 0 || busy || session.error) && (
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border py-1">
          <ThreadHistory
            turns={session.turns}
            activeId={session.activeId}
            disabled={busy}
            onSelect={(id) => {
              dispatch({ type: "select", id });
              focusComposer();
            }}
          />
          <button
            type="button"
            onClick={reset}
            className="ml-auto shrink-0 rounded-sm py-2 text-xs text-ink-muted hover:text-ink"
          >
            Start fresh
          </button>
        </div>
      )}
      <div
        ref={scroll}
        tabIndex={0}
        aria-label="Active analytical workspace"
        className="min-h-0 min-w-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain py-5 pr-1"
      >
        {!question ? (
          <div className="py-5 sm:py-8">
            <h2 className="text-xl font-semibold text-ink">
              What would you like to investigate?
            </h2>
            <p className="mt-2 max-w-[65ch] text-sm leading-6 text-ink-secondary">
              Ask about {scope.clientName}&apos;s performance, then follow the evidence into a
              campaign or its creatives.
            </p>
            <div className="mt-6 flex max-w-xl flex-col items-start gap-1">
              {ASK_SUGGESTIONS.map((text) => (
                <button
                  key={text}
                  type="button"
                  onClick={() => void ask(text)}
                  className="flex w-full items-center justify-between gap-4 rounded-sm border-b border-border py-3 text-left text-sm text-ink-secondary transition-colors hover:text-accent"
                >
                  <span>{text}</span>
                  <ArrowRight size={14} aria-hidden className="shrink-0 text-ink-faint" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div
              key={`question-${session.pending?.id ?? session.error?.id ?? active?.id}`}
              className="mb-6 flex justify-end motion-safe:animate-rise-in"
            >
              <p className="max-w-[85%] rounded-lg border border-border/60 bg-surface-hover px-3 py-2 text-[13px] leading-5 [overflow-wrap:anywhere] whitespace-pre-wrap text-ink sm:max-w-[75%]">
                {question}
              </p>
            </div>
            {busy && (
              <p role="status" className="py-2 text-sm text-ink-muted">
                Analyzing the selected client and periods…
              </p>
            )}
            {session.error && (
              <div role="alert" className="max-w-xl py-2">
                <h2 className="text-base font-medium text-ink">
                  The analysis could not be completed.
                </h2>
                <p className="mt-2 text-sm text-ink-secondary">
                  Your question is preserved. Try again; no new answer has been added to the
                  thread.
                </p>
                <button
                  type="button"
                  onClick={() => void ask(session.error!.question, session.error!.context)}
                  className="mt-3 rounded-sm py-1 text-sm font-medium text-accent hover:underline"
                >
                  Retry question
                </button>
              </div>
            )}
            {answered && <AnswerView key={active.id} answer={active.answer} />}
          </>
        )}
      </div>
      <div className="shrink-0 border-t border-border bg-surface pt-3">
        {answered && (
          <div
            key={`follow-${active.id}`}
            aria-label="Suggested follow-up questions"
            className="mb-3 flex max-h-28 flex-wrap gap-x-4 gap-y-1 overflow-y-auto motion-safe:animate-fade-in motion-safe:[animation-delay:var(--duration-standard)] motion-reduce:[animation-delay:0ms]"
          >
            {active.answer.followUps.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => void ask(text)}
                className="rounded-sm py-1.5 text-left text-xs leading-5 text-ink-secondary transition-colors hover:text-accent"
              >
                {text}
                <ArrowRight className="ml-1.5 inline" size={12} aria-hidden />
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void ask(draft);
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) focusComposer();
          }}
          className="flex items-end gap-3 rounded-lg border border-border bg-surface-subtle px-3 py-2 shadow-xs transition-colors focus-within:border-ink-muted focus-within:bg-surface"
        >
          <label htmlFor={inputId} className="sr-only">
            Ask about campaigns, creatives or performance
          </label>
          <textarea
            ref={input}
            id={inputId}
            aria-describedby={helpId}
            rows={1}
            value={draft}
            maxLength={ASK_MAX_QUESTION_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                if (!busy) void ask(draft);
              }
            }}
            placeholder="Ask about campaigns, creatives or performance…"
            className="my-1.5 max-h-12 min-h-6 min-w-0 flex-1 resize-none bg-transparent text-sm leading-6 text-ink outline-hidden placeholder:text-ink-muted"
          />
          <button
            type={busy ? "button" : "submit"}
            aria-label={busy ? "Cancel analysis" : "Send question"}
            disabled={!busy && !draft.trim()}
            onClick={(event) => {
              if (busy) {
                event.preventDefault();
                cancel();
              }
            }}
            className="flex size-9 shrink-0 items-center justify-center rounded-md bg-ink text-surface transition-colors hover:bg-ink-secondary disabled:bg-border disabled:text-ink-faint"
          >
            {busy ? (
              <Square size={13} aria-hidden />
            ) : (
              <ArrowUp size={18} strokeWidth={1.75} aria-hidden />
            )}
          </button>
        </form>
        <p id={helpId} className="mt-2 text-[11px] leading-4 text-ink-muted">
          Enter to send · Shift+Enter for a new line · no external AI
        </p>
        <p role="status" className="sr-only">
          {notice}
        </p>
      </div>
    </section>
  );
}

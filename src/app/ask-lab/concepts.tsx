"use client";

import {
  createContext,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  CornerDownLeft,
  RotateCcw,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StaticPresets } from "../campaigns-lab/lab-frame";
import { AnswerClose, AnswerIntro, AnswerTable, Entities, Evidence, FollowUps } from "./answer";
import {
  QUESTIONS,
  answerForQuestion,
  type AskLabModel,
  type LabAnswer,
  type QuestionId,
} from "./model";

type Variant = "a" | "b" | "c";
type Preview = "example" | "empty" | "pending" | "error" | "limits";
type Status = "ready" | "pending" | "error";
interface Turn {
  key: number;
  question: string;
  answer: LabAnswer;
}

const LABELS: Record<Variant, string> = {
  a: "Concept A — Analyst Chat",
  b: "Concept B — Analytical Query Workspace",
  c: "Concept C — Hybrid Analyst Thread",
};

function initialTurns(lab: AskLabModel): Turn[] {
  return (["cpa", "campaign"] as QuestionId[]).map((id, key) => ({
    key,
    question: QUESTIONS[id],
    answer: lab.answers[id],
  }));
}

function useLabThread(lab: AskLabModel) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [activeKey, setActiveKey] = useState(0);
  const [draft, setDraft] = useState("");
  const [pendingQuestion, setPendingQuestion] = useState("");
  const [preview, setPreview] = useState<Preview>("empty");
  const status: Status = preview === "pending" || preview === "error" ? preview : "ready";
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const focusComposer = useRef(false);
  const sequence = useRef(0);
  const active = turns.find((turn) => turn.key === activeKey) ?? turns.at(-1);

  const cancel = () => {
    focusComposer.current = true;
    setDraft(pendingQuestion);
    setPendingQuestion("");
    setPreview(turns.length ? "example" : "empty");
  };
  const ask = (question: string) => {
    const text = question.trim();
    if (!text) return;
    // Prepared answers resolve immediately. Pending/error are explicit review
    // states only, never a timer-driven imitation of a remote analysis service.
    const key = sequence.current++;
    focusComposer.current = true;
    setTurns((current) => [
      ...current,
      { key, question: text, answer: answerForQuestion(text, lab) },
    ]);
    setActiveKey(key);
    setDraft("");
    setPendingQuestion("");
    setPreview("example");
  };
  const changePreview = (value: Preview) => {
    focusComposer.current = value === "empty";
    const next = value === "empty" ? [] : initialTurns(lab);
    if (value === "limits")
      next.push({ key: 2, question: QUESTIONS.limits, answer: lab.answers.limits });
    setTurns(next);
    setActiveKey(next.at(-1)?.key ?? 0);
    sequence.current = next.length;
    setDraft("");
    setPendingQuestion(value === "pending" || value === "error" ? QUESTIONS.creatives : "");
    setPreview(value);
  };
  useEffect(() => {
    if (focusComposer.current) {
      composerRef.current?.focus({ preventScroll: true });
      focusComposer.current = false;
    }
  }, [activeKey, preview, turns]);

  return {
    turns,
    active,
    activeKey,
    setActiveKey,
    draft,
    setDraft,
    composerRef,
    status,
    pendingQuestion,
    preview,
    changePreview,
    ask,
    cancel,
  };
}

type LabContextValue = {
  lab: AskLabModel;
  variant: Variant;
  thread: ReturnType<typeof useLabThread>;
};
const LabContext = createContext<LabContextValue | null>(null);
function useLab() {
  const value = useContext(LabContext);
  if (!value) throw new Error("Ask concepts must be rendered in their review frame.");
  return value;
}

/** Controls live outside the product frame, so simulated states cannot look live. */
export function ConceptReview({
  lab,
  variant,
  children,
}: {
  lab: AskLabModel;
  variant: Variant;
  children: ReactNode;
}) {
  const thread = useLabThread(lab);
  const previewId = useId();
  return (
    <LabContext.Provider value={{ lab, variant, thread }}>
      <section className="mb-14" aria-label={LABELS[variant]} data-concept={variant}>
        <div className="mb-3 flex items-center justify-between gap-6">
          <h2 className="text-base font-semibold text-ink">{LABELS[variant]}</h2>
          <div className="flex items-center gap-3 text-xs text-ink-secondary">
            <span>Lab fixtures · no AI</span>
            <label htmlFor={previewId}>Preview</label>
            <select
              id={previewId}
              value={thread.preview}
              onChange={(event) => thread.changePreview(event.target.value as Preview)}
              className="h-8 rounded-md border border-border-strong bg-surface px-2 text-sm text-ink"
            >
              <option value="empty">First use</option>
              <option value="example">Example thread</option>
              <option value="pending">Pending</option>
              <option value="error">Error</option>
              <option value="limits">Insufficient evidence</option>
            </select>
          </div>
        </div>
        {children}
      </section>
    </LabContext.Provider>
  );
}

function Header() {
  const { lab } = useLab();
  return (
    <header className="mb-6 flex shrink-0 items-start justify-between gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Ask Analyst</h1>
        <p className="mt-1 text-sm text-ink-muted">
          {lab.clientName} · Questions grounded in your performance data
        </p>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <div className="text-right text-xs leading-5">
          <p className="font-medium text-ink-secondary tabular">{lab.currentLabel}</p>
          <p className="text-ink-muted">vs {lab.comparison}</p>
        </div>
        <StaticPresets selected="7d" />
      </div>
    </header>
  );
}

function Composer() {
  const { lab, thread } = useLab();
  const { composerRef, draft } = thread;
  const inputId = useId();
  const hintId = useId();
  const pending = thread.status === "pending";
  useLayoutEffect(() => {
    const input = composerRef.current;
    if (!input) return;
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight);
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, lineHeight * 2)}px`;
  }, [composerRef, draft]);
  return (
    <div className="shrink-0 bg-surface pt-4">
      <form
        onClick={(event) => {
          if (event.target === event.currentTarget) composerRef.current?.focus();
        }}
        onSubmit={(event) => {
          event.preventDefault();
          thread.ask(thread.draft);
        }}
        className="flex cursor-text items-end gap-3 rounded-lg border border-border bg-surface-subtle px-3 py-2 shadow-xs transition-colors focus-within:border-accent focus-within:bg-surface focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask about campaigns, creatives or performance
        </label>
        <textarea
          id={inputId}
          ref={composerRef}
          aria-describedby={hintId}
          rows={1}
          value={thread.draft}
          disabled={pending}
          onChange={(event) => thread.setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              if (!pending) event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ask about campaigns, creatives or performance…"
          className="my-1.5 min-w-0 flex-1 resize-none scrollbar-thin bg-transparent text-base leading-6 text-ink caret-accent outline-none placeholder:text-ink-muted focus-visible:outline-none disabled:cursor-wait"
        />
        <button
          type={pending ? "button" : "submit"}
          aria-label={pending ? "Cancel pending question" : "Send question"}
          title={pending ? "Cancel pending question" : "Send question"}
          disabled={!pending && !thread.draft.trim()}
          onClick={(event) => {
            if (pending) {
              event.preventDefault();
              thread.cancel();
            }
          }}
          className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-ink bg-ink text-white transition-colors hover:border-ink-secondary hover:bg-ink-secondary active:bg-ink disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-active disabled:text-ink-faint"
        >
          {pending ? (
            <Square size={13} aria-hidden />
          ) : (
            <ArrowUp size={18} strokeWidth={1.75} aria-hidden />
          )}
        </button>
      </form>
      <div id={hintId} className="mt-2 flex justify-between gap-4 text-xs text-ink-muted">
        <span>
          {lab.clientName} · Last 7 days · {lab.comparison}
        </span>
        <span className="flex items-center gap-1.5">
          <CornerDownLeft size={12} aria-hidden />
          Enter to send · Shift+Enter for a new line
        </span>
      </div>
    </div>
  );
}

function UserTurn({ question }: { question: string }) {
  return (
    <div className="mb-5 flex animate-rise-in justify-end motion-reduce:animate-none">
      <p
        className="max-w-[75%] rounded-lg border border-border/60 bg-surface-hover px-3 py-2 text-sm leading-5 whitespace-pre-wrap text-ink"
        style={{ overflowWrap: "anywhere" }}
      >
        <span className="sr-only">You asked: </span>
        {question}
      </p>
    </div>
  );
}

function EmptyState() {
  const { lab, thread } = useLab();
  return (
    <div className="max-w-[680px] py-10">
      <h3 className="text-xl font-semibold">What would you like to investigate?</h3>
      <p className="mt-2 max-w-[60ch] text-base leading-6 text-ink-secondary">
        Ask about {lab.clientName}’s performance, then follow the evidence into a campaign or
        its creatives.
      </p>
      <div className="mt-6 divide-y divide-border border-y border-border">
        {(["cpa", "campaign", "limits"] as QuestionId[]).map((id) => (
          <button
            key={id}
            onClick={() => thread.ask(QUESTIONS[id])}
            className="flex w-full items-center justify-between gap-4 py-4 text-left text-base text-ink transition-colors hover:text-accent"
          >
            {QUESTIONS[id]}
            <ArrowRight size={16} aria-hidden className="text-ink-muted" />
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs leading-5 text-ink-muted">
        This lab answers the example questions only. Figures are calculated from the seeded
        dataset; no AI is connected.
      </p>
    </div>
  );
}

function Recovery() {
  const { thread } = useLab();
  return (
    <div
      className="animate-rise-in py-6 motion-reduce:animate-none"
      role="status"
      aria-live="polite"
    >
      <p className="text-base font-medium">
        {thread.status === "pending"
          ? "Analyzing selected-period data…"
          : "Unable to analyze this question."}
      </p>
      <p className="mt-2 text-sm text-ink-muted">
        {thread.status === "pending"
          ? "The selected client and comparison period stay in scope."
          : "Your question is preserved. Try again to load the example response."}
      </p>
      {thread.status === "error" && (
        <Button className="mt-4" onClick={() => thread.ask(thread.pendingQuestion)}>
          <RotateCcw size={13} aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}

function OpenAnswer({
  answer,
  supportingRail = false,
  interactive = true,
  showFollowUps = true,
}: {
  answer: LabAnswer;
  supportingRail?: boolean;
  interactive?: boolean;
  showFollowUps?: boolean;
}) {
  const { lab, thread } = useLab();
  return (
    <>
      <AnswerIntro answer={answer} />
      {!supportingRail && (
        <div className="mt-5">
          <Evidence answer={answer} currency={lab.currency} />
        </div>
      )}
      <AnswerTable answer={answer} lab={lab} />
      {!supportingRail && answer.entities.length > 0 && (
        <p className="mt-4 text-xs leading-5 text-ink-muted">
          <span className="font-medium text-ink-secondary">In scope · </span>
          {answer.scope}
        </p>
      )}
      <AnswerClose
        answer={answer}
        onAsk={thread.ask}
        disabled={!interactive || thread.status !== "ready"}
        showFollowUps={showFollowUps}
      />
    </>
  );
}

function AnalystChat() {
  const { thread } = useLab();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = scroller.current;
    const latest =
      thread.status === "ready"
        ? container?.querySelector("article:last-of-type")
        : container?.lastElementChild;
    if (container && latest) {
      container.scrollTop +=
        latest.getBoundingClientRect().top - container.getBoundingClientRect().top;
    }
  }, [thread.turns, thread.status]);
  return (
    <div className="mx-auto flex min-h-0 w-full max-w-[900px] flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border pb-3 text-xs text-ink-muted">
        <span>One analytical thread · {thread.turns.length} answered questions</span>
        <button
          onClick={() => thread.changePreview("empty")}
          className="rounded-sm py-1 hover:text-ink"
        >
          Start fresh
        </button>
      </div>
      <div
        ref={scroller}
        className="min-h-0 flex-1 scrollbar-thin overflow-y-auto overscroll-contain pr-4"
        aria-label="Analyst conversation"
        tabIndex={0}
      >
        {!thread.turns.length && thread.status === "ready" && <EmptyState />}
        {thread.turns.map((turn, index) => (
          <article key={turn.key} className="border-b border-border py-6 last:border-0">
            <UserTurn question={turn.question} />
            <div className="animate-fade-in motion-reduce:animate-none">
              <OpenAnswer
                answer={turn.answer}
                interactive={index === thread.turns.length - 1}
              />
            </div>
          </article>
        ))}
        {thread.status !== "ready" && (
          <div className="py-6">
            <UserTurn question={thread.pendingQuestion} />
            <Recovery />
          </div>
        )}
      </div>
      <Composer />
    </div>
  );
}

function RecentQuestions() {
  const { thread } = useLab();
  if (!thread.turns.length) return null;
  return (
    <section className="mt-8 border-t border-border pt-4">
      <h3 className="text-xs font-medium text-ink-muted">Recent questions · this thread</h3>
      <div className="mt-2 divide-y divide-border">
        {[...thread.turns].reverse().map((turn) => (
          <button
            key={turn.key}
            disabled={thread.status !== "ready"}
            aria-pressed={turn.key === thread.activeKey}
            onClick={() => thread.setActiveKey(turn.key)}
            className="flex w-full items-center justify-between gap-4 rounded-sm py-2.5 text-left text-sm text-ink-secondary hover:text-ink disabled:cursor-not-allowed aria-pressed:font-medium aria-pressed:text-accent"
          >
            {turn.question}
            <span className="text-xs text-ink-muted">
              {turn.key === thread.activeKey ? "Current answer" : "Revisit"}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function QueryWorkspace() {
  const { lab, thread } = useLab();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [thread.activeKey, thread.status]);
  return (
    <>
      <Composer />
      <div
        ref={scroller}
        className="mt-6 min-h-0 flex-1 scrollbar-thin overflow-y-auto overscroll-contain pr-2"
        tabIndex={0}
        aria-label="Query workspace"
      >
        {!thread.active && thread.status === "ready" ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_272px] gap-8">
              <div className="min-w-0">
                <p className="mb-5 border-b border-border pb-4 text-lg font-medium text-ink">
                  {thread.status === "ready" ? thread.active?.question : thread.pendingQuestion}
                </p>
                {thread.status !== "ready" ? (
                  <Recovery />
                ) : (
                  thread.active && (
                    <div
                      key={thread.active.key}
                      className="animate-rise-in motion-reduce:animate-none"
                    >
                      <OpenAnswer answer={thread.active.answer} supportingRail />
                    </div>
                  )
                )}
              </div>
              <aside className="border-l border-border pl-6" aria-label="Evidence and scope">
                <h3 className="mb-3 text-xs font-medium text-ink-secondary">
                  Evidence in scope
                </h3>
                <p className="mb-4 text-xs leading-5 text-ink-muted">
                  {thread.status === "ready"
                    ? thread.active?.answer.scope
                    : "Awaiting the current answer"}
                </p>
                {thread.status === "ready" && thread.active && (
                  <>
                    <Evidence answer={thread.active.answer} currency={lab.currency} vertical />
                    <Entities answer={thread.active.answer} />
                  </>
                )}
                <div className="mt-6 border-t border-border pt-4 text-xs leading-5 text-ink-muted">
                  <p className="font-medium text-ink-secondary">{lab.clientName}</p>
                  <p>{lab.currentLabel}</p>
                  <p>Compared with {lab.previousLabel}</p>
                  <p className="mt-2">Seeded Meta Ads · not live data</p>
                </div>
              </aside>
            </div>
            <RecentQuestions />
          </>
        )}
      </div>
    </>
  );
}

function HybridThread() {
  const { thread } = useLab();
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [thread.activeKey, thread.status]);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start justify-between gap-8 border-y border-border py-3">
        <details className="group min-w-0 flex-1">
          <summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-sm py-1 text-sm text-ink-muted">
            <ChevronDown
              size={14}
              aria-hidden
              className="transition-transform group-open:rotate-180"
            />
            Earlier in this thread · {Math.max(0, thread.turns.length - 1)}{" "}
            {thread.turns.length === 2 ? "question" : "questions"}
          </summary>
          <div className="mt-2 grid gap-1 pb-1">
            {thread.turns
              .filter((turn) => turn.key !== thread.activeKey)
              .map((turn) => (
                <button
                  key={turn.key}
                  disabled={thread.status !== "ready"}
                  onClick={(event) => {
                    thread.setActiveKey(turn.key);
                    event.currentTarget.closest("details")?.removeAttribute("open");
                  }}
                  className="rounded-sm px-6 py-2 text-left text-sm text-ink-secondary hover:bg-surface-subtle hover:text-ink disabled:cursor-not-allowed"
                >
                  {turn.question}
                </button>
              ))}
            {thread.turns.length < 2 && (
              <p className="px-6 text-xs text-ink-muted">Previous answers will stay here.</p>
            )}
          </div>
        </details>
        <button
          onClick={() => thread.changePreview("empty")}
          className="shrink-0 rounded-sm py-1 text-xs text-ink-muted hover:text-ink"
        >
          Start fresh
        </button>
      </div>
      <div
        ref={scroller}
        className="min-h-0 flex-1 scrollbar-thin overflow-y-auto overscroll-contain pr-4"
        aria-label="Active analytical answer"
        tabIndex={0}
      >
        {!thread.active && thread.status === "ready" ? (
          <EmptyState />
        ) : (
          <div
            key={thread.status === "ready" ? thread.active?.key : thread.pendingQuestion}
            className="py-6"
          >
            <UserTurn
              question={
                (thread.status === "ready"
                  ? thread.active?.question
                  : thread.pendingQuestion) ?? ""
              }
            />
            {thread.status !== "ready" ? (
              <Recovery />
            ) : (
              thread.active && (
                <div className="animate-fade-in motion-reduce:animate-none">
                  <OpenAnswer answer={thread.active.answer} showFollowUps={false} />
                </div>
              )
            )}
          </div>
        )}
      </div>
      {thread.status === "ready" && thread.active && (
        <div className="shrink-0 border-t border-border">
          <FollowUps ids={thread.active.answer.followUps} onAsk={thread.ask} />
        </div>
      )}
      <Composer />
    </div>
  );
}

export function ConceptView() {
  const { variant, thread } = useLab();
  return (
    <div className="flex h-[920px] flex-col">
      <Header />
      {variant === "a" ? (
        <AnalystChat />
      ) : variant === "b" ? (
        <QueryWorkspace />
      ) : (
        <HybridThread />
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {thread.status === "ready" && thread.active
          ? `Answer ready: ${thread.active.answer.title}`
          : ""}
      </p>
    </div>
  );
}

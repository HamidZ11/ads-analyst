"use client";

import { ChevronLeft } from "lucide-react";
import { Dialog } from "radix-ui";
import { useRef, useState, useSyncExternalStore } from "react";
import {
  DETECTOR_LABELS,
  ENTITY_TYPE_LABELS,
  PRIORITY_ORDER,
  formatInsightValue,
  type Finding,
  type InsightPriority,
} from "@/domain/insights";
import { cn } from "@/lib/cn";
import { FindingDetail } from "./finding-detail";
import type { InsightsModel } from "./insights-model";
import { PriorityDot } from "./priority";

type Filter = "all" | InsightPriority;

const GROUP_TITLES: Record<InsightPriority, string> = {
  high: "Needs attention",
  opportunity: "Opportunities",
  watch: "Watch",
};

const TABS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "high", label: "High impact" },
  { value: "opportunity", label: "Opportunities" },
  { value: "watch", label: "Watch" },
];

/** Master/detail from 1280px; below it the detail opens as a sheet. */
const DESKTOP_QUERY = "(min-width: 1280px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useDesktop() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => true,
  );
}

function emptyCopy(filter: Filter, model: InsightsModel) {
  const total = model.findings.length;
  if (total === 0)
    return {
      title: "No findings for this period",
      description: `None of the detector conditions were met for ${model.clientName} ${model.period}. The engine checks zero-conversion spend, cost and ROAS changes, CTR and creative fatigue patterns, spend concentration, and scaling, improving or underfunded campaigns and ads. Findings are recomputed whenever the client or period changes.`,
    };
  const elsewhere = `${total} ${total === 1 ? "finding is" : "findings are"} listed under All.`;
  if (filter === "high")
    return { title: "No high-impact findings for this period.", description: elsewhere };
  if (filter === "opportunity")
    return { title: "No opportunities found for this period.", description: elsewhere };
  if (filter === "watch")
    return { title: "Nothing to watch for this period.", description: elsewhere };
  return { title: "No findings for the selected filter.", description: elsewhere };
}

function FindingRow({
  finding,
  selected,
  desktop,
  currency,
  onSelect,
}: {
  finding: Finding;
  selected: boolean;
  desktop: boolean;
  currency: InsightsModel["currency"];
  onSelect: (button: HTMLButtonElement) => void;
}) {
  const entity = `${ENTITY_TYPE_LABELS[finding.entity.type]} · ${finding.entity.name}`;
  return (
    <li>
      <button
        type="button"
        aria-pressed={desktop ? selected : undefined}
        aria-haspopup={desktop ? undefined : "dialog"}
        onClick={(event) => onSelect(event.currentTarget)}
        className={cn(
          "relative flex w-full items-start gap-4 rounded-md px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
          selected && desktop
            ? "bg-surface-subtle before:absolute before:inset-y-3 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
            : "hover:bg-surface-hover",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-xs text-ink-muted">
            <PriorityDot priority={finding.priority} />
            {DETECTOR_LABELS[finding.detector]}
          </span>
          <span className="mt-1 block text-sm leading-5 font-medium text-ink">
            {finding.headline}
          </span>
          <span className="mt-1 block truncate text-xs text-ink-muted" title={entity}>
            {entity}
          </span>
        </span>
        <span className="shrink-0 pt-[18px] text-right">
          <span className="block text-sm font-semibold whitespace-nowrap text-ink tabular">
            {formatInsightValue(finding.key.value, finding.key.format, currency)}
          </span>
          <span className="mt-0.5 block text-xs whitespace-nowrap text-ink-muted">
            {finding.key.label}
          </span>
        </span>
      </button>
    </li>
  );
}

/**
 * The Insights workspace: the briefing sentence, priority filters with real
 * counts, a ranked list of findings grouped by priority, and the selected
 * finding's evidence. Selection and filtering are local state; the engine
 * ran on the server for the selected client and period.
 */
export function InsightsWorkspace({ model }: { model: InsightsModel }) {
  const { findings, counts, currency } = model;
  const desktop = useDesktop();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(findings[0]?.id ?? null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [animate, setAnimate] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const visible = filter === "all" ? findings : findings.filter((f) => f.priority === filter);
  const selected = visible.find((f) => f.id === selectedId) ?? visible[0] ?? null;
  const total = findings.length;

  function applyFilter(next: Filter) {
    setFilter(next);
    const nextVisible = next === "all" ? findings : findings.filter((f) => f.priority === next);
    // Keep the selection when it survives the filter; otherwise the first finding.
    if (!nextVisible.some((f) => f.id === selectedId)) {
      setSelectedId(nextVisible[0]?.id ?? null);
      setAnimate(true);
    }
  }

  function select(finding: Finding, button: HTMLButtonElement) {
    triggerRef.current = button;
    if (finding.id !== selected?.id) setAnimate(true);
    setSelectedId(finding.id);
    if (!desktop) setSheetOpen(true);
  }

  const groups = PRIORITY_ORDER.map((priority) => ({
    priority,
    items: visible.filter((f) => f.priority === priority),
  })).filter((group) => group.items.length > 0);
  const empty = visible.length === 0 ? emptyCopy(filter, model) : null;

  return (
    <div>
      <p className="max-w-[760px] text-base leading-6 font-medium tracking-[-0.01em] text-ink">
        {model.briefing}
      </p>

      <div className="mt-6 flex items-end justify-between gap-6 border-b border-border">
        <div
          role="group"
          aria-label="Filter findings by priority"
          className="flex gap-4 sm:gap-6"
        >
          {TABS.map((tab) => {
            const pressed = tab.value === filter;
            const count = tab.value === "all" ? total : counts[tab.value];
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={pressed}
                onClick={() => applyFilter(tab.value)}
                className={cn(
                  "-mb-px flex h-9 items-center gap-1.5 border-b-2 text-sm font-medium whitespace-nowrap transition-colors",
                  pressed
                    ? "border-accent text-ink"
                    : "border-transparent text-ink-muted hover:text-ink",
                )}
              >
                {tab.label}
                <span className="text-xs text-ink-faint tabular">{count}</span>
              </button>
            );
          })}
        </div>
        <p className="hidden pb-2.5 text-xs text-ink-muted md:block">
          Ordered by priority, then by spend involved
        </p>
      </div>

      {empty ? (
        <div role="status" className="max-w-[640px] py-10">
          <p className="text-sm font-medium text-ink">{empty.title}</p>
          <p className="mt-1 text-xs leading-5 text-ink-muted">{empty.description}</p>
        </div>
      ) : (
        <div className="min-[1280px]:grid min-[1280px]:grid-cols-[380px_minmax(0,1fr)] min-[1280px]:gap-8 min-[1400px]:grid-cols-[400px_minmax(0,1fr)] min-[1400px]:gap-10">
          <div className="min-w-0 pb-2">
            {groups.map((group) => (
              <section
                key={group.priority}
                aria-labelledby={`insights-group-${group.priority}`}
              >
                <h2
                  id={`insights-group-${group.priority}`}
                  className="flex items-center gap-2 px-3 pt-5 pb-1 text-xs font-medium text-ink-secondary"
                >
                  {GROUP_TITLES[group.priority]}
                  <span className="text-ink-faint tabular">{group.items.length}</span>
                </h2>
                <ol className="flex flex-col gap-0.5">
                  {group.items.map((finding) => (
                    <FindingRow
                      key={finding.id}
                      finding={finding}
                      selected={finding.id === selected?.id}
                      desktop={desktop}
                      currency={currency}
                      onSelect={(button) => select(finding, button)}
                    />
                  ))}
                </ol>
              </section>
            ))}
          </div>

          {desktop && selected ? (
            <div
              aria-live="polite"
              className="hidden scrollbar-thin border-l border-border pt-6 pl-8 min-[1400px]:pl-10 xl:sticky xl:top-8 xl:block xl:max-h-[calc(100dvh-4rem)] xl:self-start xl:overflow-y-auto xl:pr-1 xl:pb-6"
            >
              <FindingDetail
                key={selected.id}
                finding={selected}
                currency={currency}
                currentLabel={model.currentLabel}
                previousLabel={model.previousLabel}
                animate={animate}
              />
            </div>
          ) : null}
        </div>
      )}

      <p className="mt-8 border-t border-border pt-4 text-xs leading-5 text-ink-muted">
        Findings are computed from stored daily metrics for {model.currentLabel} against the{" "}
        {model.comparison}. Suggested actions are advisory and are never applied automatically.
      </p>

      <Dialog.Root
        open={!desktop && sheetOpen && selected !== null}
        onOpenChange={(open) => (open ? null : setSheetOpen(false))}
        modal={false}
      >
        <Dialog.Portal>
          <Dialog.Content
            onInteractOutside={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => {
              // A tap does not always focus the row, so return focus explicitly.
              const target = triggerRef.current;
              if (target) {
                event.preventDefault();
                target.focus();
              }
            }}
            className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-surface shadow-md focus:outline-none data-[state=closed]:animate-fade-out data-[state=open]:animate-rise-in motion-reduce:animate-none sm:w-[480px]"
          >
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
              <Dialog.Close className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink">
                <ChevronLeft aria-hidden size={16} />
                All findings
              </Dialog.Close>
              {selected ? (
                <span className="pr-2 text-xs text-ink-muted tabular">
                  {visible.indexOf(selected) + 1} of {visible.length}
                </span>
              ) : null}
            </div>
            <div className="flex-1 scrollbar-thin overflow-y-auto px-4 pt-5 pb-8 sm:px-6">
              {selected ? (
                <FindingDetail
                  key={selected.id}
                  finding={selected}
                  currency={currency}
                  currentLabel={model.currentLabel}
                  previousLabel={model.previousLabel}
                  inDialog
                />
              ) : null}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

import { ChevronDown, ChevronsUpDown } from "lucide-react";
import { formatDate } from "@/domain/format";
import { NAV_GROUPS, PRIMARY_NAV } from "@/features/navigation";
import type { Workspace } from "@/features/workspace/server";
import { cn } from "@/lib/cn";

/**
 * Three static sidebar concepts. They share the production navigation config
 * and icon family; everything else (surfaces, hierarchy, active state,
 * switcher, footer) is the concept. Markup is deliberately not shared.
 */

interface ConceptProps {
  workspace: Workspace;
  activeHref?: string;
}

function coverageLine(workspace: Workspace): string {
  const { coverage } = workspace;
  return coverage
    ? `${coverage.days} days to ${formatDate(coverage.lastDate)}`
    : "No metrics loaded";
}

/* ------------------------------------------------------------------ */
/* Concept A — Quiet Analytical Rail                                   */
/* ------------------------------------------------------------------ */

export function ConceptA({ workspace, activeHref = "/" }: ConceptProps) {
  const { agency, client } = workspace;
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-canvas">
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="flex size-[18px] items-center justify-center rounded-[5px] bg-ink text-white"
          >
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path
                d="M2 11.5 6.2 2.5h1.6L12 11.5h-1.9l-1-2.3H4.9l-1 2.3H2Zm3.5-3.8h3L7 4.2 5.5 7.7Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="text-[13px] font-semibold tracking-[-0.01em] text-ink">
            Ad Analyst
          </span>
        </div>
        <p className="mt-1 pl-[26px] text-xs text-ink-muted">{agency.name}</p>
      </div>

      <button
        type="button"
        className="group mx-3 mt-5 flex h-11 items-center gap-2.5 rounded-md px-2 text-left transition-colors hover:bg-surface-active"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface-active text-[11px] font-semibold text-ink-secondary ring-1 ring-black/5 ring-inset">
          LS
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[13px] font-medium text-ink">{client.name}</span>
          <span className="block truncate text-xs text-ink-muted">
            Ecommerce · {client.currency}
          </span>
        </span>
        <ChevronsUpDown
          aria-hidden
          size={14}
          className="shrink-0 text-ink-faint transition-colors group-hover:text-ink-muted"
        />
      </button>

      <nav aria-label="Primary (concept A)" className="mt-5 flex-1 px-3">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && "mt-7")}>
            <p className="mb-1.5 px-2.5 text-xs text-ink-faint">{group.label}</p>
            <ul className="flex flex-col gap-px">
              {PRIMARY_NAV.filter((item) => item.group === group.id).map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <span
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors",
                        active
                          ? "font-medium text-accent-strong before:absolute before:top-2 before:bottom-2 before:-left-3 before:w-0.5 before:rounded-r before:bg-accent"
                          : "font-medium text-ink-secondary hover:bg-surface-active hover:text-ink",
                      )}
                    >
                      <Icon
                        aria-hidden
                        size={16}
                        strokeWidth={active ? 2 : 1.5}
                        className={cn("shrink-0", active ? "text-accent" : "text-ink-faint")}
                      />
                      {item.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="px-5 pt-3 pb-4 text-xs leading-4 text-ink-faint">
        <p className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-positive/70" />
          <span className="text-ink-muted">Meta Ads · demo dataset</span>
        </p>
        <p className="mt-0.5 pl-3 tabular">{coverageLine(workspace)}</p>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Concept B — Premium Workspace Nav                                   */
/* ------------------------------------------------------------------ */

export function ConceptB({ workspace, activeHref = "/" }: ConceptProps) {
  const { agency, client } = workspace;
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-canvas">
      <div className="flex items-center gap-2.5 px-4 pt-4">
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-ink text-white"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 11.5 6.2 2.5h1.6L12 11.5h-1.9l-1-2.3H4.9l-1 2.3H2Zm3.5-3.8h3L7 4.2 5.5 7.7Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[14px] font-semibold tracking-[-0.01em] text-ink">
            Ad Analyst
          </span>
          <span className="block truncate text-xs text-ink-muted">{agency.name}</span>
        </span>
      </div>

      <div className="px-3 pt-4">
        <p className="px-1 pb-1.5 text-xs text-ink-faint">Client</p>
        <button
          type="button"
          className="group flex h-11 w-full items-center gap-2.5 rounded-md border border-border bg-surface px-2 text-left transition-[color,background-color,border-color] hover:border-border-strong hover:bg-surface-hover"
        >
          <span className="relative flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-[11px] font-semibold text-accent-strong">
            LS
            <span
              aria-hidden
              className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full bg-positive ring-2 ring-surface"
            />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[13px] font-medium text-ink">
              {client.name}
            </span>
            <span className="block truncate text-xs text-ink-muted">
              Ecommerce · {client.currency}
            </span>
          </span>
          <ChevronsUpDown
            aria-hidden
            size={14}
            className="shrink-0 text-ink-faint transition-colors group-hover:text-ink"
          />
        </button>
      </div>

      <nav aria-label="Primary (concept B)" className="mt-5 flex-1 px-3">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && "mt-5 border-t border-border pt-4")}>
            <p className="mb-1.5 px-2.5 text-xs font-medium text-ink-muted">{group.label}</p>
            <ul className="flex flex-col gap-0.5">
              {PRIMARY_NAV.filter((item) => item.group === group.id).map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <span
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex h-[34px] items-center gap-2.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors",
                        active
                          ? "border-border bg-surface text-ink"
                          : "border-transparent text-ink-secondary hover:bg-surface-active hover:text-ink",
                      )}
                    >
                      <Icon
                        aria-hidden
                        size={16}
                        strokeWidth={active ? 2 : 1.5}
                        className={cn("shrink-0", active ? "text-accent" : "text-ink-muted")}
                      />
                      {item.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 py-2">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-positive" />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-xs font-medium text-ink-secondary">
            Meta Ads · demo dataset
          </span>
          <span className="block truncate text-xs text-ink-muted tabular">
            {coverageLine(workspace)}
          </span>
        </span>
        <ChevronDown aria-hidden size={14} className="shrink-0 text-ink-faint" />
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Concept C — Compact Professional Tool                               */
/* ------------------------------------------------------------------ */

export function ConceptC({ workspace, activeHref = "/" }: ConceptProps) {
  const { agency, client } = workspace;
  return (
    <aside className="flex w-[224px] shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex h-11 items-center gap-2 border-b border-border px-3">
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-ink text-white"
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 11.5 6.2 2.5h1.6L12 11.5h-1.9l-1-2.3H4.9l-1 2.3H2Zm3.5-3.8h3L7 4.2 5.5 7.7Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.01em] text-ink">
          Ad Analyst
        </span>
        <span className="truncate text-[11px] text-ink-faint">{agency.name}</span>
      </div>

      <button
        type="button"
        className="group flex h-9 items-center gap-2 border-b border-border px-3 text-left transition-colors hover:bg-surface-hover"
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-[4px] bg-ink text-[10px] font-semibold text-white">
          LS
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
          {client.name}
        </span>
        <span className="shrink-0 text-[11px] text-ink-muted">Ecom · {client.currency}</span>
        <ChevronDown
          aria-hidden
          size={13}
          className="shrink-0 text-ink-faint transition-colors group-hover:text-ink-muted"
        />
      </button>

      <nav aria-label="Primary (concept C)" className="flex-1 px-2 pt-3">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.id} className={cn(index > 0 && "mt-4")}>
            <p className="mb-1 px-2 text-[11px] font-medium text-ink-faint">{group.label}</p>
            <ul className="flex flex-col">
              {PRIMARY_NAV.filter((item) => item.group === group.id).map((item) => {
                const active = item.href === activeHref;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <span
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "relative flex h-7 items-center gap-2 rounded-[4px] px-2 text-[13px] transition-colors",
                        active
                          ? "bg-surface-active font-medium text-ink before:absolute before:inset-y-1 before:-left-2 before:w-0.5 before:rounded-r before:bg-accent"
                          : "text-ink-secondary hover:bg-surface-hover hover:text-ink",
                      )}
                    >
                      <Icon
                        aria-hidden
                        size={15}
                        strokeWidth={active ? 2 : 1.5}
                        className={cn("shrink-0", active ? "text-ink" : "text-ink-muted")}
                      />
                      {item.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="flex h-9 items-center gap-2 border-t border-border px-3 text-[11px] leading-none text-ink-muted">
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-positive" />
        <span className="truncate">Meta Ads · demo</span>
        <span className="ml-auto shrink-0 text-ink-faint tabular">
          {coverageLine(workspace)}
        </span>
      </div>
    </aside>
  );
}

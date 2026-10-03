import Link from "next/link";
import type { ReactNode } from "react";
import { ClientSwitcher } from "@/components/shell/client-switcher";
import { ProductMark } from "@/components/shell/product-mark";
import { formatDate } from "@/domain/format";
import { DATE_PRESETS } from "@/domain/periods";
import { isActivePath, NAV_GROUPS, PRIMARY_NAV } from "@/features/navigation";
import type { Workspace } from "@/features/workspace/server";
import { cn } from "@/lib/cn";

/**
 * The approved production shell around each concept. The product mark and the
 * client switcher are the real components; the navigation is a replica with
 * the production classes and "Campaigns" active, because the real `NavLinks`
 * derives its active item from the lab's own URL.
 */
export function LabFrame({
  workspace,
  children,
}: {
  workspace: Workspace;
  children: ReactNode;
}) {
  const { agency, clients, client, coverage } = workspace;
  const switcherClients = clients.map(({ id, name, type, currency }) => ({
    id,
    name,
    type,
    currency,
  }));
  return (
    <div className="flex overflow-hidden border border-border-strong bg-surface">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-canvas">
        <div className="flex h-full flex-col">
          <div className="px-4 pt-4">
            <ProductMark agencyName={agency.name} />
          </div>
          <div className="px-3 pt-4">
            <p className="px-1 pb-1.5 text-xs text-ink-faint">Client</p>
            <ClientSwitcher
              agencyName={agency.name}
              clients={switcherClients}
              selectedId={client.id}
              connected={coverage !== null}
            />
          </div>
          <nav aria-label="Primary (lab replica)" className="mt-5 flex-1 px-3">
            <div className="flex flex-col">
              {NAV_GROUPS.map((group, index) => (
                <div
                  key={group.id}
                  className={cn(index > 0 && "mt-5 border-t border-border pt-4")}
                >
                  <p className="mb-1.5 px-2.5 text-xs font-medium text-ink-muted">
                    {group.label}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {PRIMARY_NAV.filter((item) => item.group === group.id).map((item) => {
                      const active = isActivePath("/campaigns", item.href);
                      const Icon = item.icon;
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex h-[34px] items-center gap-2.5 rounded-md border px-2.5 text-sm font-medium transition-colors",
                              active
                                ? "border-border bg-surface text-ink"
                                : "border-transparent text-ink-secondary hover:bg-surface-active hover:text-ink",
                            )}
                          >
                            <Icon
                              aria-hidden
                              size={16}
                              strokeWidth={active ? 2 : 1.5}
                              className={cn(
                                "shrink-0 transition-colors",
                                active ? "text-accent" : "text-ink-muted",
                              )}
                            />
                            <span className="truncate">{item.label}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </nav>
          <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 py-2 text-xs">
            <span
              aria-hidden
              className={`size-1.5 shrink-0 rounded-full ${coverage ? "bg-positive" : "bg-ink-faint"}`}
            />
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate font-medium text-ink-secondary">
                Meta Ads · demo dataset
              </span>
              <span className="block truncate text-ink-muted tabular">
                {coverage
                  ? `${coverage.days} days to ${formatDate(coverage.lastDate)}`
                  : "No metrics loaded"}
              </span>
            </span>
          </div>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-surface px-10 py-8">{children}</main>
    </div>
  );
}

/** Static replica of the production date preset control (clicking the real one changes the cookie). */
export function StaticPresets({ selected }: { selected: string }) {
  return (
    <div
      role="group"
      aria-label="Date range (static)"
      className="inline-flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5"
    >
      {DATE_PRESETS.map((preset) => (
        <span
          key={preset.id}
          className={cn(
            "flex h-7 items-center rounded-sm px-2.5 text-xs font-medium",
            preset.id === selected
              ? "bg-accent-soft text-accent-strong"
              : preset.available
                ? "text-ink-muted"
                : "text-ink-faint",
          )}
        >
          {preset.label}
        </span>
      ))}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, NAV_GROUPS, PRIMARY_NAV } from "@/features/navigation";
import { cn } from "@/lib/cn";

/**
 * Grouped primary navigation (Concept B). The current page is a white,
 * hairline-bordered row with ink text and a blue icon; other rows are quiet
 * and tint on hover. The Workspace group is separated by one hairline.
 */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex flex-col">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.id} className={cn(index > 0 && "mt-5 border-t border-border pt-4")}>
          <p
            id={`nav-group-${group.id}`}
            className="mb-1.5 px-2.5 text-xs font-medium text-ink-muted"
          >
            {group.label}
          </p>
          <ul aria-labelledby={`nav-group-${group.id}`} className="flex flex-col gap-0.5">
            {PRIMARY_NAV.filter((item) => item.group === group.id).map((item) => {
              const active = isActivePath(pathname, item.href);
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
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActivePath, NAV_GROUPS, PRIMARY_NAV } from "@/features/navigation";
import { cn } from "@/lib/cn";

export function NavLinks() {
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-5">
      {NAV_GROUPS.map((group) => (
        <div key={group.id}>
          <p
            id={`nav-group-${group.id}`}
            className="px-2.5 pb-1.5 text-2xs font-medium tracking-wide text-ink-faint uppercase"
          >
            {group.label}
          </p>
          <ul aria-labelledby={`nav-group-${group.id}`} className="flex flex-col gap-px">
            {PRIMARY_NAV.filter((item) => item.group === group.id).map((item) => {
              const active = isActivePath(pathname, item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
                      active
                        ? "bg-accent-soft font-medium text-accent-strong"
                        : "font-normal text-ink-secondary hover:bg-surface-active hover:text-ink",
                    )}
                  >
                    <Icon
                      aria-hidden
                      size={16}
                      strokeWidth={active ? 2.1 : 1.75}
                      className={cn("shrink-0", active ? "text-accent" : "text-ink-muted")}
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

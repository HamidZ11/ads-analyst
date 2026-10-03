"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useOptimistic, useTransition } from "react";
import { ClientMark } from "@/components/ui/client-mark";
import { CLIENT_TYPE_LABELS } from "@/domain/labels";
import type { Client } from "@/domain/types";
import { selectClient } from "@/features/workspace/actions";
import { cn } from "@/lib/cn";

export interface ClientSwitcherProps {
  agencyName: string;
  clients: readonly Pick<Client, "id" | "name" | "type" | "currency">[];
  selectedId: string;
  variant?: "sidebar" | "compact";
}

export function ClientSwitcher({
  agencyName,
  clients,
  selectedId,
  variant = "sidebar",
}: ClientSwitcherProps) {
  const [pending, startTransition] = useTransition();
  const [optimisticId, setOptimisticId] = useOptimistic(selectedId);
  const selected = clients.find((c) => c.id === optimisticId) ?? clients[0];

  const onSelect = (id: string) => {
    if (id === optimisticId) return;
    startTransition(async () => {
      setOptimisticId(id);
      await selectClient(id);
    });
  };

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Switch client. Current client: ${selected.name}`}
        aria-busy={pending || undefined}
        className={cn(
          "group flex items-center gap-2 rounded-md border border-border bg-surface text-left transition-[color,background-color,border-color,opacity] hover:border-border-strong hover:bg-surface-hover active:bg-surface-active data-[state=open]:border-accent-border data-[state=open]:bg-accent-soft",
          variant === "sidebar" ? "h-10 w-full px-2" : "h-8 max-w-[200px] px-1.5",
          pending && "opacity-70",
        )}
      >
        <ClientMark name={selected.name} selected size={variant === "sidebar" ? "md" : "sm"} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{selected.name}</span>
          {variant === "sidebar" ? (
            <span className="block truncate text-2xs text-ink-muted">
              {CLIENT_TYPE_LABELS[selected.type]} · {selected.currency}
            </span>
          ) : null}
        </span>
        <ChevronsUpDown
          aria-hidden
          size={14}
          className="shrink-0 text-ink-faint transition-colors group-data-[state=open]:text-accent-strong"
        />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[240px] origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-lg border border-border bg-surface p-1 shadow-md data-[state=closed]:animate-menu-out data-[state=open]:animate-menu-in motion-reduce:animate-none"
        >
          <DropdownMenu.Label className="px-2 pt-1.5 pb-1 text-2xs font-medium text-ink-muted">
            {agencyName}
          </DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={optimisticId} onValueChange={onSelect}>
            {clients.map((client) => (
              <DropdownMenu.RadioItem
                key={client.id}
                value={client.id}
                className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 transition-colors outline-none select-none data-[highlighted]:bg-surface-hover data-[state=checked]:bg-accent-soft"
              >
                <ClientMark
                  name={client.name}
                  size="sm"
                  selected={client.id === optimisticId}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {client.name}
                  </span>
                  <span className="block truncate text-2xs text-ink-muted">
                    {CLIENT_TYPE_LABELS[client.type]} · {client.currency}
                  </span>
                </span>
                <DropdownMenu.ItemIndicator>
                  <Check aria-hidden size={14} className="text-accent-strong" />
                </DropdownMenu.ItemIndicator>
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

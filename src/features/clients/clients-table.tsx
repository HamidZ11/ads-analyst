import { Check, ChevronRight } from "lucide-react";
import { ClientMark } from "@/components/ui/client-mark";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import type { DataCoverage } from "@/data";
import { formatCurrency, formatDate, formatDateRange, formatMultiple } from "@/domain/format";
import { CLIENT_TYPE_LABELS, tracksRevenue } from "@/domain/labels";
import type { Client, ClientDataSource } from "@/domain/types";
import { selectClient } from "@/features/workspace/actions";

export interface ClientListRow {
  client: Client;
  coverage: DataCoverage | null;
  source: ClientDataSource;
  accountId: string | null;
}

/* One client per row, read left to right: who it is, where its data comes
   from, what it is held to, how much data there is, then a quiet action.
   Below 768px the same rows become a labelled list. */

function identity({ client, accountId }: ClientListRow): string {
  return [CLIENT_TYPE_LABELS[client.type], client.currency, accountId]
    .filter(Boolean)
    .join(" · ");
}

function sourceLines({ source }: ClientListRow): [string, string] {
  if (source.kind !== "meta_csv") return ["Demo dataset", "Seeded · read-only"];
  const latest = source.imports[0];
  return [
    "Meta Ads · CSV import",
    latest ? `Last import ${formatDate(latest.importedAt.slice(0, 10))}` : "No imports yet",
  ];
}

function targetValues({
  client,
}: ClientListRow): Array<{ label: string; value: string | null; empty: string }> {
  return [
    {
      label: "CPA",
      value:
        client.targetCpa === null ? null : formatCurrency(client.targetCpa, client.currency),
      empty: "Not set",
    },
    {
      label: "ROAS",
      value: client.targetRoas === null ? null : formatMultiple(client.targetRoas, 1),
      empty: tracksRevenue(client) ? "Not set" : "Not tracked",
    },
  ];
}

function dataLines({ coverage }: ClientListRow): [string, string] | null {
  if (!coverage) return null;
  return [
    `${coverage.days} ${coverage.days === 1 ? "day" : "days"}`,
    formatDateRange({ start: coverage.firstDate, end: coverage.lastDate }),
  ];
}

function Identity({
  row,
  selected,
  wrap = false,
}: {
  row: ClientListRow;
  selected: boolean;
  wrap?: boolean;
}) {
  return (
    <span className="flex min-w-0 items-center gap-3">
      <ClientMark name={row.client.name} selected={selected} size="lg" />
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-ink">{row.client.name}</span>
        <span
          className={`mt-0.5 block text-xs text-ink-muted tabular ${wrap ? "break-words" : "truncate"}`}
        >
          {identity(row)}
        </span>
      </span>
    </span>
  );
}

function Lines({ lines }: { lines: [string, string] }) {
  return (
    <span className="block leading-tight">
      <span className="block text-sm text-ink-secondary">{lines[0]}</span>
      <span className="mt-1 block text-xs text-ink-muted tabular">{lines[1]}</span>
    </span>
  );
}

function Targets({ row, inline = false }: { row: ClientListRow; inline?: boolean }) {
  return (
    <dl
      className={
        inline
          ? "flex flex-wrap gap-x-4 gap-y-1 text-sm leading-tight"
          : "grid grid-cols-[auto_auto] justify-start gap-x-2.5 gap-y-1 text-sm leading-tight"
      }
    >
      {targetValues(row).map((target) => (
        <div key={target.label} className={inline ? "flex items-baseline gap-1.5" : "contents"}>
          <dt className="text-xs leading-[18px] text-ink-muted">{target.label}</dt>
          <dd className={target.value ? "text-ink tabular" : "text-ink-faint"}>
            {target.value ?? target.empty}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Data({ row, inline = false }: { row: ClientListRow; inline?: boolean }) {
  const lines = dataLines(row);
  return (
    <span className="flex items-start gap-2">
      <span
        aria-hidden
        className={`mt-[7px] size-1.5 shrink-0 rounded-full ${lines ? "bg-positive" : "bg-ink-faint"}`}
      />
      {!lines ? (
        <span className="text-sm text-ink-muted">No data yet</span>
      ) : inline ? (
        <span className="text-sm text-ink-secondary tabular">
          {lines[0]} <span className="text-ink-muted">· {lines[1]}</span>
        </span>
      ) : (
        <Lines lines={lines} />
      )}
    </span>
  );
}

function Action({ row, selected }: { row: ClientListRow; selected: boolean }) {
  if (selected)
    return (
      <span className="inline-flex h-8 items-center gap-1.5 text-xs font-medium text-accent-strong">
        <Check aria-hidden size={14} strokeWidth={2} />
        Selected
      </span>
    );
  return (
    <form action={selectClient.bind(null, row.client.id)}>
      <button
        type="submit"
        aria-label={`Select ${row.client.name}`}
        className="group -mr-2 inline-flex h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-ink-secondary transition-colors hover:bg-surface-hover hover:text-ink md:h-8"
      >
        Select
        <ChevronRight
          aria-hidden
          size={15}
          className="text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-ink-muted"
        />
      </button>
    </form>
  );
}

export function ClientsTable({
  rows,
  selectedId,
}: {
  rows: ClientListRow[];
  selectedId: string;
}) {
  return (
    <>
      <div className="hidden md:block">
        <Table
          caption="Agency clients with source, targets and data status"
          wrapperClassName="[contain:paint]"
        >
          <THead>
            <Tr>
              <Th className="w-[34%]">Client</Th>
              <Th>Source</Th>
              <Th>Targets</Th>
              <Th>Data</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((row) => {
              const selected = row.client.id === selectedId;
              return (
                <Tr
                  key={row.client.id}
                  className={selected ? "bg-accent-soft/40" : "hover:bg-surface-subtle"}
                >
                  <Td className="h-auto py-3.5">
                    <Identity row={row} selected={selected} />
                  </Td>
                  <Td className="h-auto py-3.5">
                    <Lines lines={sourceLines(row)} />
                  </Td>
                  <Td className="h-auto py-3.5">
                    <Targets row={row} />
                  </Td>
                  <Td className="h-auto py-3.5">
                    <Data row={row} />
                  </Td>
                  <Td className="h-auto py-3.5 text-right">
                    <Action row={row} selected={selected} />
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </div>

      <ul aria-label="Agency clients" className="divide-y divide-border md:hidden">
        {rows.map((row) => {
          const selected = row.client.id === selectedId;
          return (
            <li key={row.client.id} className={selected ? "bg-accent-soft/40 p-4" : "p-4"}>
              <div className="flex items-start justify-between gap-3">
                <Identity row={row} selected={selected} wrap />
                <Action row={row} selected={selected} />
              </div>
              <dl className="mt-3 grid grid-cols-[60px_1fr] gap-x-3 gap-y-2.5 pl-10">
                <dt className="pt-px text-xs text-ink-muted">Source</dt>
                <dd>
                  <Lines lines={sourceLines(row)} />
                </dd>
                <dt className="pt-px text-xs text-ink-muted">Targets</dt>
                <dd>
                  <Targets row={row} inline />
                </dd>
                <dt className="pt-px text-xs text-ink-muted">Data</dt>
                <dd>
                  <Data row={row} inline />
                </dd>
              </dl>
            </li>
          );
        })}
      </ul>
    </>
  );
}

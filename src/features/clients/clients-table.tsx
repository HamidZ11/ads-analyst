import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientMark } from "@/components/ui/client-mark";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import type { DataCoverage } from "@/data";
import { formatCurrency, formatDate, formatMultiple } from "@/domain/format";
import { CLIENT_TYPE_LABELS, tracksRevenue } from "@/domain/labels";
import type { Client, ClientDataSource } from "@/domain/types";
import { selectClient } from "@/features/workspace/actions";

export interface ClientListRow {
  client: Client;
  coverage: DataCoverage | null;
  source: ClientDataSource;
  accountId: string | null;
}

export function ClientsTable({
  rows,
  selectedId,
}: {
  rows: ClientListRow[];
  selectedId: string;
}) {
  return (
    // Paint containment keeps the wide table's overflow inside its scroller, so
    // phones lay the page out at device width instead of zooming out.
    <Table
      caption="Agency clients with targets and data status"
      wrapperClassName="[contain:paint]"
    >
      <THead>
        <Tr>
          <Th>Client</Th>
          <Th>Industry</Th>
          <Th>Currency</Th>
          <Th>Source</Th>
          <Th numeric>Target CPA</Th>
          <Th numeric>Target ROAS</Th>
          <Th>Data status</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map(({ client, coverage, source, accountId }) => {
          const latest = source.imports[0];
          const selected = client.id === selectedId;
          return (
            <Tr
              key={client.id}
              className={selected ? "bg-accent-soft/40" : "hover:bg-surface-subtle"}
            >
              <Td>
                <span className="flex items-center gap-2.5">
                  <ClientMark name={client.name} selected={selected} />
                  <span className="font-medium text-ink">{client.name}</span>
                </span>
              </Td>
              <Td className="text-ink-secondary">{CLIENT_TYPE_LABELS[client.type]}</Td>
              <Td className="text-ink-secondary">{client.currency}</Td>
              <Td>
                {source.kind === "meta_csv" ? (
                  <span className="block leading-tight">
                    <span className="block text-ink-secondary">Meta CSV import</span>
                    <span className="block text-xs text-ink-muted tabular">
                      {latest
                        ? `Last import ${formatDate(latest.importedAt.slice(0, 10))}`
                        : "No imports"}
                      {accountId ? ` · ${accountId}` : ""}
                    </span>
                  </span>
                ) : (
                  <span className="block leading-tight">
                    <span className="block text-ink-secondary">Demo dataset</span>
                    <span className="block text-xs text-ink-muted">Seeded · read-only</span>
                  </span>
                )}
              </Td>
              <Td numeric>
                {client.targetCpa === null ? (
                  <span className="text-ink-faint">Not set</span>
                ) : (
                  formatCurrency(client.targetCpa, client.currency)
                )}
              </Td>
              <Td numeric>
                {client.targetRoas !== null ? (
                  formatMultiple(client.targetRoas, 1)
                ) : tracksRevenue(client) && source.kind === "meta_csv" ? (
                  <span className="text-ink-faint">Not set</span>
                ) : (
                  <span className="text-ink-faint">Not tracked</span>
                )}
              </Td>
              <Td>
                {coverage ? (
                  <span className="flex items-center gap-1.5 text-ink-secondary">
                    <span aria-hidden className="size-1.5 rounded-full bg-positive" />
                    {coverage.days} days · to {formatDate(coverage.lastDate)}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-ink-muted">
                    <span aria-hidden className="size-1.5 rounded-full bg-ink-faint" />
                    No data
                  </span>
                )}
              </Td>
              <Td className="text-right">
                {selected ? (
                  <Badge tone="accent">Selected</Badge>
                ) : (
                  <form action={selectClient.bind(null, client.id)}>
                    <Button type="submit" size="sm" aria-label={`Select ${client.name}`}>
                      Select
                    </Button>
                  </form>
                )}
              </Td>
            </Tr>
          );
        })}
      </TBody>
    </Table>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClientMark } from "@/components/ui/client-mark";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import type { DataCoverage } from "@/data";
import { formatCurrency, formatDate, formatMultiple } from "@/domain/format";
import { CLIENT_TYPE_LABELS } from "@/domain/labels";
import type { Client } from "@/domain/types";
import { selectClient } from "@/features/workspace/actions";

export interface ClientListRow {
  client: Client;
  coverage: DataCoverage | null;
}

export function ClientsTable({
  rows,
  selectedId,
}: {
  rows: ClientListRow[];
  selectedId: string;
}) {
  return (
    <Table caption="Agency clients with targets and data status">
      <THead>
        <Tr>
          <Th>Client</Th>
          <Th>Industry</Th>
          <Th>Currency</Th>
          <Th>Timezone</Th>
          <Th numeric>Target CPA</Th>
          <Th numeric>Target ROAS</Th>
          <Th>Data status</Th>
          <Th>
            <span className="sr-only">Actions</span>
          </Th>
        </Tr>
      </THead>
      <TBody>
        {rows.map(({ client, coverage }) => {
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
              <Td className="text-ink-secondary">{client.timezone}</Td>
              <Td numeric>{formatCurrency(client.targetCpa, client.currency)}</Td>
              <Td numeric>
                {client.targetRoas === null ? (
                  <span className="text-ink-faint">Not tracked</span>
                ) : (
                  formatMultiple(client.targetRoas, 1)
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

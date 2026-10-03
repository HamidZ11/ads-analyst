import type { DataCoverage } from "@/data";
import { formatDate } from "@/domain/format";
import type { Agency, Client, DataSourceKind } from "@/domain/types";
import { ClientSwitcher } from "./client-switcher";
import { NavLinks } from "./nav-links";
import { ProductMark } from "./product-mark";

export interface SidebarProps {
  agency: Agency;
  clients: Client[];
  /** Null only while the workspace has no clients yet. */
  client: Client | null;
  coverage: DataCoverage | null;
  /** Labels the data-state tile; defaults to the seeded demo dataset. */
  sourceKind?: DataSourceKind;
}

/**
 * Shared sidebar body, rendered both in the desktop rail and the mobile sheet.
 * Hierarchy: product and agency, then the client (the operating context),
 * then grouped navigation, then the data state as a quiet tile.
 */
export function Sidebar({
  agency,
  clients,
  client,
  coverage,
  sourceKind = "seed",
}: SidebarProps) {
  const switcherClients = clients.map(({ id, name, type, currency }) => ({
    id,
    name,
    type,
    currency,
  }));
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4">
        <ProductMark agencyName={agency.name} />
      </div>
      <div className="px-3 pt-4">
        <p className="px-1 pb-1.5 text-xs text-ink-faint">Client</p>
        {client ? (
          <ClientSwitcher
            agencyName={agency.name}
            clients={switcherClients}
            selectedId={client.id}
            connected={coverage !== null}
          />
        ) : (
          <p className="flex h-11 items-center rounded-md border border-dashed border-border-strong px-2.5 text-sm text-ink-muted">
            No clients yet
          </p>
        )}
      </div>
      <nav aria-label="Primary" className="mt-5 flex-1 px-3">
        <NavLinks />
      </nav>
      <div className="mx-3 mb-3 flex items-center gap-2.5 rounded-md border border-border bg-surface px-2.5 py-2 text-xs">
        <span
          aria-hidden
          className={`size-1.5 shrink-0 rounded-full ${coverage ? "bg-positive" : "bg-ink-faint"}`}
        />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate font-medium text-ink-secondary">
            {sourceKind === "meta_csv" ? "Meta Ads · CSV import" : "Meta Ads · demo dataset"}
          </span>
          <span className="block truncate text-ink-muted tabular">
            {coverage
              ? `${coverage.days} days to ${formatDate(coverage.lastDate)}`
              : "No metrics loaded"}
          </span>
        </span>
      </div>
    </div>
  );
}

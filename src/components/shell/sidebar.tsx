import type { DataCoverage } from "@/data";
import { formatDate } from "@/domain/format";
import type { Agency, Client } from "@/domain/types";
import { ClientSwitcher } from "./client-switcher";
import { NavLinks } from "./nav-links";
import { ProductMark } from "./product-mark";

export interface SidebarProps {
  agency: Agency;
  clients: Client[];
  client: Client;
  coverage: DataCoverage | null;
}

/** Shared sidebar body, rendered both in the desktop rail and the mobile sheet. */
export function Sidebar({ agency, clients, client, coverage }: SidebarProps) {
  const switcherClients = clients.map(({ id, name, type, currency }) => ({
    id,
    name,
    type,
    currency,
  }));
  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-5 pb-4">
        <ProductMark agencyName={agency.name} size="lg" />
      </div>
      <div className="px-3">
        <ClientSwitcher
          agencyName={agency.name}
          clients={switcherClients}
          selectedId={client.id}
        />
      </div>
      <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pt-5">
        <NavLinks />
      </nav>
      <div className="px-4 py-4 text-xs text-ink-muted">
        <p className="flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-positive" />
          Meta Ads · demo data
        </p>
        <p className="mt-0.5 pl-3 text-ink-faint">
          {coverage
            ? `${coverage.days} days to ${formatDate(coverage.lastDate)}`
            : "No metrics loaded"}
        </p>
      </div>
    </div>
  );
}

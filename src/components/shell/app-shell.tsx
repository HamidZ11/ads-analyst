import type { ReactNode } from "react";
import type { DataCoverage } from "@/data";
import type { Agency, Client } from "@/domain/types";
import { ClientSwitcher } from "./client-switcher";
import { MobileNav } from "./mobile-nav";
import { ProductMark } from "./product-mark";
import { Sidebar } from "./sidebar";

export interface AppShellProps {
  agency: Agency;
  clients: Client[];
  client: Client;
  coverage: DataCoverage | null;
  children: ReactNode;
}

export function AppShell({ agency, clients, client, coverage, children }: AppShellProps) {
  const sidebar = (
    <Sidebar agency={agency} clients={clients} client={client} coverage={coverage} />
  );
  const switcherClients = clients.map(({ id, name, type, currency }) => ({
    id,
    name,
    type,
    currency,
  }));

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-surface px-3 py-2 text-sm font-medium text-accent-strong shadow-md focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r border-border bg-canvas lg:block">
        {sidebar}
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-2 border-b border-border bg-canvas px-3 lg:hidden">
          <MobileNav>{sidebar}</MobileNav>
          <ProductMark />
          <div className="ml-auto">
            <ClientSwitcher
              agencyName={agency.name}
              clients={switcherClients}
              selectedId={client.id}
              variant="compact"
            />
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto min-h-dvh w-full max-w-[1440px] bg-surface px-4 py-5 outline-none sm:px-6 lg:px-10 lg:py-8"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

import type { AdAnalystRepository, DataCoverage } from "@/data";
import {
  comparisonLabel,
  periodAnchor,
  periodPairForPreset,
  todayInTimezone,
  type DatePreset,
  type PeriodPair,
} from "@/domain/periods";
import type { AdAccount, Agency, Client, ClientDataSource, IsoDate } from "@/domain/types";

/**
 * The resolved operating context for a request, with no Next.js imports so it
 * can be tested directly. `client` is null only for an empty workspace.
 */
export interface WorkspaceContext {
  mode: "demo" | "supabase";
  user: { id: string; email: string | null } | null;
  workspace: { id: string; name: string };
  agency: Agency;
  clients: Client[];
  client: Client | null;
  adAccount: AdAccount | null;
  coverage: DataCoverage | null;
  dataSource: ClientDataSource | null;
  preset: DatePreset;
  periods: PeriodPair;
  comparison: string;
  today: IsoDate;
  repository: AdAnalystRepository;
  /** Imports need a database; demo mode is read-only. */
  canImport: boolean;
}

/**
 * The requested item when it is in the list the user can access, otherwise
 * the first one. A cookie can only choose among accessible items; it never
 * grants access.
 */
export function chooseActive<T extends { id: string }>(
  items: readonly T[],
  requested: string | null | undefined,
): T | null {
  return items.find((item) => item.id === requested) ?? items[0] ?? null;
}

export function buildContext(input: {
  mode: WorkspaceContext["mode"];
  user: WorkspaceContext["user"];
  workspace: WorkspaceContext["workspace"];
  repository: AdAnalystRepository;
  requestedClientId: string | null | undefined;
  preset: DatePreset;
  canImport: boolean;
  /** Fallback timezone for "today" when the workspace has no client. */
  defaultTimezone?: string;
  now?: Date;
}): WorkspaceContext {
  const { repository } = input;
  const clients = repository.listClients();
  const client = chooseActive(clients, input.requestedClientId);
  const today = todayInTimezone(
    client?.timezone ?? input.defaultTimezone ?? "Europe/London",
    input.now,
  );
  const coverage = client ? repository.getCoverage(client.id) : null;
  // Periods end today, or on the last day with data when that is earlier.
  const periods = periodPairForPreset(
    input.preset,
    periodAnchor(today, coverage?.lastDate ?? null),
  );
  return {
    mode: input.mode,
    user: input.user,
    workspace: input.workspace,
    agency: repository.getAgency(),
    clients,
    client,
    adAccount: client ? (repository.listAdAccounts(client.id)[0] ?? null) : null,
    coverage,
    dataSource: client ? repository.getDataSource(client.id) : null,
    preset: input.preset,
    periods,
    comparison: comparisonLabel(periods),
    today,
    repository,
    canImport: input.canImport,
  };
}

/** "ana@agency.test" → "Ana's workspace"; no email → "My workspace". */
export function defaultWorkspaceName(email: string | null): string {
  const local = email
    ?.split("@")[0]
    ?.replace(/[^\p{L}\p{N}._-]/gu, "")
    .slice(0, 60);
  return local
    ? `${local.charAt(0).toUpperCase()}${local.slice(1)}'s workspace`
    : "My workspace";
}

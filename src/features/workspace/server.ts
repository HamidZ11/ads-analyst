import { cache } from "react";
import { cookies } from "next/headers";
import { getRepository, type AdAnalystRepository, type DataCoverage } from "@/data";
import {
  comparisonLabel,
  parseDatePreset,
  periodAnchor,
  periodPairForPreset,
  todayInTimezone,
  type DatePreset,
  type PeriodPair,
} from "@/domain/periods";
import type { AdAccount, Agency, Client, ClientDataSource, IsoDate } from "@/domain/types";
import { CLIENT_COOKIE, RANGE_COOKIE } from "./cookies";

/**
 * Everything a page needs to render in the context of the selected client.
 * Read once per request (React `cache`) from the workspace cookies.
 */
export interface Workspace {
  agency: Agency;
  clients: Client[];
  client: Client;
  adAccount: AdAccount | null;
  coverage: DataCoverage | null;
  /** Where the client's data came from; for labels only, never for analysis. */
  dataSource: ClientDataSource;
  preset: DatePreset;
  periods: PeriodPair;
  comparison: string;
  today: IsoDate;
  repository: AdAnalystRepository;
}

export const getWorkspace = cache(async (): Promise<Workspace> => {
  const store = await cookies();
  const repository = getRepository();
  const clients = repository.listClients();
  const requestedClient = store.get(CLIENT_COOKIE)?.value;
  const client = (requestedClient && repository.getClient(requestedClient)) || clients[0];
  const preset = parseDatePreset(store.get(RANGE_COOKIE)?.value);
  const today = todayInTimezone(client.timezone);
  const coverage = repository.getCoverage(client.id);
  // Seeded data always reaches today, so only imported data can move the anchor.
  const periods = periodPairForPreset(preset, periodAnchor(today, coverage?.lastDate ?? null));

  return {
    agency: repository.getAgency(),
    clients,
    client,
    adAccount: repository.listAdAccounts(client.id)[0] ?? null,
    coverage,
    dataSource: repository.getDataSource(client.id),
    preset,
    periods,
    comparison: comparisonLabel(periods),
    today,
    repository,
  };
});

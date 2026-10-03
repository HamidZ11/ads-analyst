import { getRepository } from "@/data";
import { comparisonLabel, periodPairForPreset, todayInTimezone } from "@/domain/periods";
import type { Workspace } from "@/features/workspace/server";

/**
 * A fixed Luxe Skin Co. workspace for the lab, independent of the production
 * cookies, so every concept sits beside the same approved Overview canvas.
 */
export function luxeWorkspace(): Workspace {
  const repository = getRepository();
  const clients = repository.listClients();
  const client = repository.getClient("cli_luxe") ?? clients[0];
  const today = todayInTimezone(client.timezone);
  const periods = periodPairForPreset("7d", today);
  return {
    agency: repository.getAgency(),
    clients,
    client,
    adAccount: repository.listAdAccounts(client.id)[0] ?? null,
    coverage: repository.getCoverage(client.id),
    dataSource: repository.getDataSource(client.id),
    preset: "7d",
    periods,
    comparison: comparisonLabel(periods),
    today,
    repository,
  };
}

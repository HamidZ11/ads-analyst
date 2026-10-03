import type {
  Ad,
  AdAccount,
  AdSet,
  Agency,
  Campaign,
  Client,
  ClientDataSource,
  Creative,
  DailyMetrics,
  Dataset,
  DateRange,
  IsoDate,
  MetricEntityType,
} from "@/domain/types";
import { isWithinRange } from "@/domain/periods";

export interface MetricsQuery {
  clientId: string;
  range?: DateRange;
  entityType?: MetricEntityType;
  entityIds?: readonly string[];
}

export interface DataCoverage {
  firstDate: IsoDate;
  lastDate: IsoDate;
  /** Distinct days with at least one row. */
  days: number;
  rows: number;
}

/** Fully resolved ancestry of an ad. */
export interface AdLineage {
  ad: Ad;
  adSet: AdSet;
  campaign: Campaign;
  adAccount: AdAccount;
  client: Client;
  creative: Creative;
}

/**
 * Read-side contract for everything the product needs. The in-memory
 * implementation below is seeded; a SQLite/IndexedDB implementation can
 * replace it when CSV imports arrive without touching features.
 */
export interface AdAnalystRepository {
  getAgency(): Agency;
  listClients(): Client[];
  getClient(clientId: string): Client | undefined;
  listAdAccounts(clientId: string): AdAccount[];
  listCampaigns(clientId: string): Campaign[];
  getCampaign(campaignId: string): Campaign | undefined;
  listAdSets(campaignId: string): AdSet[];
  listAdSetsForClient(clientId: string): AdSet[];
  listAds(adSetId: string): Ad[];
  listAdsForClient(clientId: string): Ad[];
  listCreatives(clientId: string): Creative[];
  getCreative(creativeId: string): Creative | undefined;
  getAdLineage(adId: string): AdLineage | undefined;
  queryMetrics(query: MetricsQuery): DailyMetrics[];
  getCoverage(clientId: string): DataCoverage | null;
  /** Where the client's data came from; "seed" when no import exists. For labels and audit only. */
  getDataSource(clientId: string): ClientDataSource;
}

function groupBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = map.get(key);
    if (bucket) bucket.push(item);
    else map.set(key, [item]);
  }
  return map;
}

function indexBy<T, K>(items: readonly T[], keyOf: (item: T) => K): Map<K, T> {
  return new Map(items.map((item) => [keyOf(item), item]));
}

export class InMemoryRepository implements AdAnalystRepository {
  private readonly clientsById: Map<string, Client>;
  private readonly accountsById: Map<string, AdAccount>;
  private readonly accountsByClient: Map<string, AdAccount[]>;
  private readonly campaignsById: Map<string, Campaign>;
  private readonly campaignsByClient: Map<string, Campaign[]>;
  private readonly adSetsById: Map<string, AdSet>;
  private readonly adSetsByCampaign: Map<string, AdSet[]>;
  private readonly adsById: Map<string, Ad>;
  private readonly adsByAdSet: Map<string, Ad[]>;
  private readonly creativesById: Map<string, Creative>;
  private readonly creativesByClient: Map<string, Creative[]>;
  /** Every metric-bearing entity id → owning client id. */
  private readonly clientByEntity: Map<string, string>;
  private readonly metricsByClient: Map<string, DailyMetrics[]>;
  private readonly metricsByEntity: Map<string, DailyMetrics[]>;
  private readonly sourcesByClient: Map<string, ClientDataSource>;

  constructor(private readonly dataset: Dataset) {
    this.clientsById = indexBy(dataset.clients, (c) => c.id);
    this.accountsById = indexBy(dataset.adAccounts, (a) => a.id);
    this.accountsByClient = groupBy(dataset.adAccounts, (a) => a.clientId);
    this.campaignsById = indexBy(dataset.campaigns, (c) => c.id);
    this.campaignsByClient = groupBy(dataset.campaigns, (c) => c.clientId);
    this.adSetsById = indexBy(dataset.adSets, (s) => s.id);
    this.adSetsByCampaign = groupBy(dataset.adSets, (s) => s.campaignId);
    this.adsById = indexBy(dataset.ads, (a) => a.id);
    this.adsByAdSet = groupBy(dataset.ads, (a) => a.adSetId);
    this.creativesById = indexBy(dataset.creatives, (c) => c.id);
    this.creativesByClient = groupBy(dataset.creatives, (c) => c.clientId);

    this.clientByEntity = new Map();
    for (const account of dataset.adAccounts)
      this.clientByEntity.set(account.id, account.clientId);
    for (const campaign of dataset.campaigns)
      this.clientByEntity.set(campaign.id, campaign.clientId);
    for (const adSet of dataset.adSets) {
      const campaign = this.campaignsById.get(adSet.campaignId);
      if (campaign) this.clientByEntity.set(adSet.id, campaign.clientId);
    }
    for (const ad of dataset.ads) {
      const clientId = this.clientByEntity.get(ad.adSetId);
      if (clientId) this.clientByEntity.set(ad.id, clientId);
    }

    this.metricsByClient = groupBy(
      dataset.dailyMetrics,
      (m) => this.clientByEntity.get(m.entityId) ?? "",
    );
    this.metricsByEntity = groupBy(dataset.dailyMetrics, (m) => m.entityId);
    this.sourcesByClient = indexBy(dataset.dataSources ?? [], (s) => s.clientId);
  }

  getAgency(): Agency {
    return this.dataset.agency;
  }

  listClients(): Client[] {
    return [...this.dataset.clients];
  }

  getClient(clientId: string): Client | undefined {
    return this.clientsById.get(clientId);
  }

  listAdAccounts(clientId: string): AdAccount[] {
    return [...(this.accountsByClient.get(clientId) ?? [])];
  }

  listCampaigns(clientId: string): Campaign[] {
    return [...(this.campaignsByClient.get(clientId) ?? [])];
  }

  getCampaign(campaignId: string): Campaign | undefined {
    return this.campaignsById.get(campaignId);
  }

  listAdSets(campaignId: string): AdSet[] {
    return [...(this.adSetsByCampaign.get(campaignId) ?? [])];
  }

  listAdSetsForClient(clientId: string): AdSet[] {
    return this.listCampaigns(clientId).flatMap((c) => this.listAdSets(c.id));
  }

  listAds(adSetId: string): Ad[] {
    return [...(this.adsByAdSet.get(adSetId) ?? [])];
  }

  listAdsForClient(clientId: string): Ad[] {
    return this.listAdSetsForClient(clientId).flatMap((s) => this.listAds(s.id));
  }

  listCreatives(clientId: string): Creative[] {
    return [...(this.creativesByClient.get(clientId) ?? [])];
  }

  getCreative(creativeId: string): Creative | undefined {
    return this.creativesById.get(creativeId);
  }

  getAdLineage(adId: string): AdLineage | undefined {
    const ad = this.adsById.get(adId);
    if (!ad) return undefined;
    const adSet = this.adSetsById.get(ad.adSetId);
    const campaign = adSet && this.campaignsById.get(adSet.campaignId);
    const adAccount = campaign && this.accountsById.get(campaign.adAccountId);
    const client = adAccount && this.clientsById.get(adAccount.clientId);
    const creative = this.creativesById.get(ad.creativeId);
    if (!adSet || !campaign || !adAccount || !client || !creative) return undefined;
    return { ad, adSet, campaign, adAccount, client, creative };
  }

  queryMetrics(query: MetricsQuery): DailyMetrics[] {
    let rows: DailyMetrics[];
    if (query.entityIds) {
      const wanted = new Set(query.entityIds);
      rows = [];
      for (const id of wanted) {
        if (this.clientByEntity.get(id) !== query.clientId) continue;
        rows.push(...(this.metricsByEntity.get(id) ?? []));
      }
    } else {
      rows = [...(this.metricsByClient.get(query.clientId) ?? [])];
    }
    const { range, entityType } = query;
    return rows.filter(
      (row) =>
        (entityType === undefined || row.entityType === entityType) &&
        (range === undefined || isWithinRange(row.date, range)),
    );
  }

  getCoverage(clientId: string): DataCoverage | null {
    const rows = this.metricsByClient.get(clientId);
    if (!rows || rows.length === 0) return null;
    const dates = new Set<IsoDate>();
    let firstDate = rows[0].date;
    let lastDate = rows[0].date;
    for (const row of rows) {
      dates.add(row.date);
      if (row.date < firstDate) firstDate = row.date;
      if (row.date > lastDate) lastDate = row.date;
    }
    return { firstDate, lastDate, days: dates.size, rows: rows.length };
  }

  getDataSource(clientId: string): ClientDataSource {
    return this.sourcesByClient.get(clientId) ?? { clientId, kind: "seed", imports: [] };
  }
}

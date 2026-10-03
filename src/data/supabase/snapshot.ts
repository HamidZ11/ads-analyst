import type {
  Ad,
  AdAccount,
  AdSet,
  Campaign,
  CampaignObjective,
  Client,
  ClientDataSource,
  ClientType,
  Creative,
  CreativeType,
  CurrencyCode,
  DailyMetrics,
  Dataset,
  EntityStatus,
  ImportRecord,
} from "@/domain/types";
import { InMemoryRepository, type DataCoverage } from "../repository";

/**
 * The JSON returned by public.workspace_snapshot: rows exactly as stored.
 * Everything a page needs for one workspace and its selected client, read in
 * one RLS-scoped call.
 */
export interface WorkspaceSnapshot {
  workspace: { id: string; name: string } | null;
  client_id: string | null;
  clients: SnapshotClient[];
  accounts: SnapshotAccount[];
  imports: SnapshotImport[];
  coverage: Array<{
    client_id: string;
    first_date: string;
    last_date: string;
    days: number;
    rows: number;
  }>;
  campaigns: Array<{
    id: string;
    client_id: string;
    ad_account_id: string;
    name: string;
    objective: string | null;
    status: string;
  }>;
  ad_sets: Array<{
    id: string;
    campaign_id: string;
    name: string;
    audience: string;
    status: string;
  }>;
  creatives: Array<{ id: string; client_id: string; name: string; type: string }>;
  ads: Array<{
    id: string;
    ad_set_id: string;
    creative_id: string;
    name: string;
    status: string;
  }>;
  metrics: Array<{
    ad_id: string;
    date: string;
    spend: number | string;
    revenue: number | string;
    conversions: number | string;
    impressions: number | string;
    clicks: number | string;
  }>;
}

export interface SnapshotClient {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  currency: string;
  timezone: string;
  target_cpa: number | string | null;
  target_roas: number | string | null;
  revenue_tracked: boolean;
  primary_conversion_column: string | null;
}

export interface SnapshotAccount {
  id: string;
  client_id: string;
  external_id: string | null;
  name: string;
  currency: string;
}

export interface SnapshotImport {
  id: string;
  client_id: string;
  file_name: string;
  file_bytes: number | string;
  row_count: number | string;
  imported_at: string;
  date_start: string;
  date_end: string;
  account_external_id: string | null;
  currency: string;
  outcome_column: string;
  revenue_column: string | null;
  new_ad_days: number | string;
  updated_ad_days: number | string;
}

const num = (value: number | string | null | undefined) =>
  value === null || value === undefined ? 0 : Number(value);
const optionalNum = (value: number | string | null | undefined) =>
  value === null || value === undefined ? null : Number(value);
const STATUSES: readonly EntityStatus[] = ["active", "paused", "archived"];
const status = (value: string): EntityStatus =>
  STATUSES.includes(value as EntityStatus) ? (value as EntityStatus) : "paused";
const OBJECTIVES: readonly CampaignObjective[] = [
  "sales",
  "leads",
  "traffic",
  "awareness",
  "engagement",
];
const TYPES: readonly CreativeType[] = ["image", "video", "carousel", "unknown"];

/** A repository whose coverage reflects every stored day, not only the days loaded. */
export class SnapshotRepository extends InMemoryRepository {
  constructor(
    dataset: Dataset,
    private readonly coverageByClient: ReadonlyMap<string, DataCoverage>,
  ) {
    super(dataset);
  }

  override getCoverage(clientId: string): DataCoverage | null {
    return this.coverageByClient.get(clientId) ?? null;
  }
}

export function toClient(row: SnapshotClient): Client {
  return {
    id: row.id,
    agencyId: row.workspace_id,
    name: row.name,
    type: row.type as ClientType,
    currency: row.currency as CurrencyCode,
    timezone: row.timezone,
    targetCpa: optionalNum(row.target_cpa),
    targetRoas: optionalNum(row.target_roas),
    revenueTracked: row.revenue_tracked,
  };
}

/** Maps a workspace snapshot to the product's normalised model, unchanged for every page. */
export function snapshotRepository(snapshot: WorkspaceSnapshot): SnapshotRepository {
  const workspace = snapshot.workspace ?? { id: "unknown", name: "Workspace" };
  const clients = snapshot.clients.map(toClient);
  const adAccounts: AdAccount[] = snapshot.accounts.map((a) => ({
    id: a.id,
    clientId: a.client_id,
    platform: "meta",
    name: a.name,
    externalId: a.external_id ?? "",
    currency: a.currency as CurrencyCode,
  }));
  const campaigns: Campaign[] = snapshot.campaigns.map((c) => ({
    id: c.id,
    adAccountId: c.ad_account_id,
    clientId: c.client_id,
    name: c.name,
    objective: OBJECTIVES.includes(c.objective as CampaignObjective)
      ? (c.objective as CampaignObjective)
      : null,
    status: status(c.status),
  }));
  const adSets: AdSet[] = snapshot.ad_sets.map((s) => ({
    id: s.id,
    campaignId: s.campaign_id,
    name: s.name,
    audience: s.audience ?? "",
    status: status(s.status),
  }));
  const ads: Ad[] = snapshot.ads.map((a) => ({
    id: a.id,
    adSetId: a.ad_set_id,
    name: a.name,
    creativeId: a.creative_id,
    status: status(a.status),
  }));
  const creatives: Creative[] = snapshot.creatives.map((c) => ({
    id: c.id,
    clientId: c.client_id,
    name: c.name,
    type: TYPES.includes(c.type as CreativeType) ? (c.type as CreativeType) : "unknown",
    thumbnail: { kind: "unavailable" },
    headline: "",
    primaryText: "",
    callToAction: "",
  }));
  const dailyMetrics: DailyMetrics[] = snapshot.metrics.map((m) => ({
    date: m.date,
    entityType: "ad",
    entityId: m.ad_id,
    spend: num(m.spend),
    revenue: num(m.revenue),
    conversions: num(m.conversions),
    impressions: num(m.impressions),
    clicks: num(m.clicks),
  }));
  const dataSources: ClientDataSource[] = clients.map((client) => ({
    clientId: client.id,
    kind: "meta_csv",
    imports: snapshot.imports
      .filter((i) => i.client_id === client.id)
      .map((i): ImportRecord => ({
        id: i.id,
        source: "meta_csv",
        importedAt: new Date(i.imported_at).toISOString(),
        fileName: i.file_name,
        fileBytes: num(i.file_bytes),
        rows: num(i.row_count),
        firstDate: i.date_start,
        lastDate: i.date_end,
        accountExternalId: i.account_external_id,
        currency: i.currency as CurrencyCode,
        outcomeColumn: i.outcome_column,
        revenueColumn: i.revenue_column,
        daysAdded: num(i.new_ad_days),
        daysReplaced: num(i.updated_ad_days),
      })),
  }));
  const coverage = new Map<string, DataCoverage>(
    snapshot.coverage.map((c) => [
      c.client_id,
      { firstDate: c.first_date, lastDate: c.last_date, days: num(c.days), rows: num(c.rows) },
    ]),
  );
  return new SnapshotRepository(
    {
      agency: { id: workspace.id, name: workspace.name },
      clients,
      adAccounts,
      campaigns,
      adSets,
      ads,
      creatives,
      dailyMetrics,
      dataSources,
    },
    coverage,
  );
}

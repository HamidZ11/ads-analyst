import type {
  Ad,
  AdAccount,
  AdSet,
  Campaign,
  Client,
  ClientDataSource,
  Creative,
  DailyMetrics,
  EntityStatus,
  ImportRecord,
  IsoDate,
} from "@/domain/types";
import { identityKeys, type ImportRow } from "./validate";

/**
 * Everything stored for one imported client: the canonical entities and
 * ad-level daily metrics the rest of the product already reads, plus the
 * import records kept for audit. Nothing here is Meta- or CSV-specific.
 */
export interface ClientDataBundle {
  client: Client;
  adAccount: AdAccount;
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  creatives: Creative[];
  dailyMetrics: DailyMetrics[];
  source: ClientDataSource;
}

export type NormalizedImport = Omit<ClientDataBundle, "client" | "source">;

/** 64-bit FNV-1a as hex: deterministic, collision-resistant enough for entity keys. */
export function stableHash(text: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < text.length; i += 1) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x01000197) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export function entityId(clientId: string, kind: "cmp" | "set" | "ad" | "cr", key: string) {
  return `${clientId}_${kind}_${stableHash(key)}`;
}

interface Latest<T> {
  date: IsoDate;
  value: T;
}

function keepLatest<T>(map: Map<string, Latest<T>>, key: string, date: IsoDate, value: T) {
  const current = map.get(key);
  if (!current || date >= current.date) map.set(key, { date, value });
}

/**
 * Builds canonical entities and ad-level daily metrics from validated rows.
 * Names, objectives and statuses come from each entity's most recent row, so
 * a rename in the platform shows the current name. Status falls back to "spent
 * on the last day of the file" only when the export has no delivery column
 * (validation has already warned about that).
 */
export type EntityKind = "cmp" | "set" | "ad" | "cr";

export function normalizeImport(
  rows: readonly ImportRow[],
  client: Client,
  account: { externalId: string | null; name: string | null },
  /** How an entity's identity key becomes its ID; client-namespaced by default. */
  idFor: (kind: EntityKind, key: string) => string = (kind, key) =>
    entityId(client.id, kind, key),
): NormalizedImport {
  const lastDate = rows.reduce((max, r) => (r.date > max ? r.date : max), "");
  const accountId = `${client.id}_acct`;
  const adAccount: AdAccount = {
    id: accountId,
    clientId: client.id,
    platform: "meta",
    name: account.name ?? `${client.name} – Meta`,
    externalId: account.externalId ?? "",
    currency: client.currency,
  };

  const campaigns = new Map<string, Latest<Campaign>>();
  const adSets = new Map<string, Latest<AdSet>>();
  const ads = new Map<string, Latest<Ad>>();
  const creatives = new Map<string, Latest<Creative>>();
  const spentLastDay = new Set<string>();
  const dailyMetrics: DailyMetrics[] = [];

  for (const row of rows) {
    const keys = identityKeys(row);
    const ids = {
      campaign: idFor("cmp", keys.campaign),
      adSet: idFor("set", keys.adSet),
      ad: idFor("ad", keys.ad),
      creative: idFor("cr", keys.creative),
    };
    if (row.date === lastDate && row.spend > 0) {
      spentLastDay.add(ids.campaign);
      spentLastDay.add(ids.adSet);
      spentLastDay.add(ids.ad);
    }
    const inferred = (id: string, stated: EntityStatus | null): EntityStatus =>
      stated ?? (spentLastDay.has(id) ? "active" : "paused");
    keepLatest(campaigns, ids.campaign, row.date, {
      id: ids.campaign,
      adAccountId: accountId,
      clientId: client.id,
      name: row.campaign.name ?? `Campaign ${row.campaign.id}`,
      objective: row.objective,
      status: inferred(ids.campaign, row.campaignStatus),
    });
    keepLatest(adSets, ids.adSet, row.date, {
      id: ids.adSet,
      campaignId: ids.campaign,
      name: row.adSet.name ?? `Ad set ${row.adSet.id}`,
      audience: "",
      status: inferred(ids.adSet, row.adSetStatus),
    });
    keepLatest(ads, ids.ad, row.date, {
      id: ids.ad,
      adSetId: ids.adSet,
      name: row.ad.name ?? `Ad ${row.ad.id}`,
      creativeId: ids.creative,
      status: inferred(ids.ad, row.adStatus),
    });
    keepLatest(creatives, ids.creative, row.date, {
      id: ids.creative,
      clientId: client.id,
      name:
        row.creative.name ??
        (row.creative.id ? `Creative ${row.creative.id}` : (row.ad.name ?? `Ad ${row.ad.id}`)),
      type: row.creativeFormat,
      thumbnail: { kind: "unavailable" },
      headline: "",
      primaryText: "",
      callToAction: "",
    });
    dailyMetrics.push({
      date: row.date,
      entityType: "ad",
      entityId: ids.ad,
      spend: row.spend,
      revenue: row.revenue,
      conversions: row.conversions,
      impressions: row.impressions,
      clicks: row.clicks,
    });
  }

  // Statuses inferred from the last day are settled once every row is seen.
  const settle = <T extends { id: string; status: EntityStatus }>(
    map: Map<string, Latest<T>>,
    stated: (row: ImportRow) => EntityStatus | null,
    key: (row: ImportRow) => string,
  ) => {
    const hasStated = new Set(rows.filter((r) => stated(r) !== null).map(key));
    return [...map.values()].map(({ value }) =>
      hasStated.has(value.id)
        ? value
        : { ...value, status: spentLastDay.has(value.id) ? "active" : "paused" },
    ) as T[];
  };
  const idOf = (kind: "campaign" | "adSet" | "ad") => (row: ImportRow) => {
    const keys = identityKeys(row);
    return idFor(kind === "campaign" ? "cmp" : kind === "adSet" ? "set" : "ad", keys[kind]);
  };

  return {
    adAccount,
    campaigns: settle(campaigns, (r) => r.campaignStatus, idOf("campaign")),
    adSets: settle(adSets, (r) => r.adSetStatus, idOf("adSet")),
    ads: settle(ads, (r) => r.adStatus, idOf("ad")),
    creatives: [...creatives.values()].map(({ value }) => value),
    dailyMetrics,
  };
}

/**
 * Duplicate policy: an import replaces the ad-day records it contains and
 * keeps every other stored day. Importing the same file twice therefore
 * changes nothing, and an overlapping export refreshes the overlap without
 * deleting days or ads it does not mention.
 */
export function mergeClientData(
  existing: ClientDataBundle | null,
  client: Client,
  incoming: NormalizedImport,
  record: Omit<ImportRecord, "daysAdded" | "daysReplaced">,
): { bundle: ClientDataBundle; daysAdded: number; daysReplaced: number } {
  const upsert = <T extends { id: string }>(before: readonly T[], after: readonly T[]) => {
    const map = new Map(before.map((e) => [e.id, e]));
    for (const e of after) map.set(e.id, e);
    return [...map.values()];
  };
  const key = (m: DailyMetrics) => `${m.entityId}|${m.date}`;
  const metrics = new Map((existing?.dailyMetrics ?? []).map((m) => [key(m), m]));
  let daysAdded = 0;
  let daysReplaced = 0;
  for (const m of incoming.dailyMetrics) {
    if (metrics.has(key(m))) daysReplaced += 1;
    else daysAdded += 1;
    metrics.set(key(m), m);
  }
  const fullRecord: ImportRecord = { ...record, daysAdded, daysReplaced };
  const adAccount: AdAccount = existing
    ? {
        ...existing.adAccount,
        externalId: existing.adAccount.externalId || incoming.adAccount.externalId,
        name: incoming.adAccount.externalId ? incoming.adAccount.name : existing.adAccount.name,
      }
    : incoming.adAccount;
  return {
    bundle: {
      client,
      adAccount,
      campaigns: upsert(existing?.campaigns ?? [], incoming.campaigns),
      adSets: upsert(existing?.adSets ?? [], incoming.adSets),
      ads: upsert(existing?.ads ?? [], incoming.ads),
      creatives: upsert(existing?.creatives ?? [], incoming.creatives),
      dailyMetrics: [...metrics.values()].sort(
        (a, b) => a.date.localeCompare(b.date) || a.entityId.localeCompare(b.entityId),
      ),
      source: {
        clientId: client.id,
        kind: "meta_csv",
        imports: [fullRecord, ...(existing?.source.imports ?? [])],
      },
    },
    daysAdded,
    daysReplaced,
  };
}

export interface ImportSummary {
  firstDate: IsoDate | null;
  lastDate: IsoDate | null;
  days: number;
  campaigns: number;
  adSets: number;
  ads: number;
  rows: number;
  spend: number;
  conversions: number;
  revenue: number;
}

/** What the preview shows: counts and totals straight from the validated rows. */
export function summarizeRows(rows: readonly ImportRow[]): ImportSummary {
  const campaigns = new Set<string>();
  const adSets = new Set<string>();
  const ads = new Set<string>();
  const dates = new Set<string>();
  let spend = 0;
  let conversions = 0;
  let revenue = 0;
  for (const row of rows) {
    const keys = identityKeys(row);
    campaigns.add(keys.campaign);
    adSets.add(keys.adSet);
    ads.add(keys.ad);
    dates.add(row.date);
    spend += row.spend;
    conversions += row.conversions;
    revenue += row.revenue;
  }
  const sorted = [...dates].sort();
  return {
    firstDate: sorted[0] ?? null,
    lastDate: sorted.at(-1) ?? null,
    days: dates.size,
    campaigns: campaigns.size,
    adSets: adSets.size,
    ads: ads.size,
    rows: rows.length,
    spend,
    conversions,
    revenue,
  };
}

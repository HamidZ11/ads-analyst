import type { Client, CurrencyCode, IsoDate } from "@/domain/types";
import { normalizeImport, stableHash } from "./normalize";
import { identityKeys, type ImportRow } from "./validate";

/**
 * What one import asks the database to write, keyed by stable source keys
 * rather than database IDs. The database upserts entities on
 * (client, source key) and daily metrics on (ad, date) in one transaction.
 * Source-agnostic: any adapter that yields ImportRows can produce it.
 */
export interface ImportPayload {
  client:
    | {
        mode: "new";
        name: string;
        type: Client["type"];
        currency: CurrencyCode;
        timezone: string;
        target_cpa: number | null;
        target_roas: number | null;
        revenue_tracked: boolean;
      }
    | { mode: "existing"; id: string };
  account: { external_id: string | null; name: string };
  campaigns: Array<{
    key: string;
    external_id: string | null;
    name: string;
    objective: string | null;
    status: string;
  }>;
  ad_sets: Array<{
    key: string;
    campaign_key: string;
    external_id: string | null;
    name: string;
    status: string;
  }>;
  creatives: Array<{ key: string; external_id: string | null; name: string; type: string }>;
  ads: Array<{
    key: string;
    ad_set_key: string;
    creative_key: string;
    external_id: string | null;
    name: string;
    status: string;
  }>;
  metrics: Array<{
    ad_key: string;
    date: IsoDate;
    spend: number;
    revenue: number;
    conversions: number;
    impressions: number;
    clicks: number;
  }>;
  import: {
    file_name: string;
    file_bytes: number;
    row_count: number;
    date_start: IsoDate;
    date_end: IsoDate;
    currency: CurrencyCode;
    outcome_column: string;
    revenue_column: string | null;
  };
}

/** Source keys: the hashed identity key, never the database ID. */
export const sourceKey = (kind: string, key: string) => `${kind}_${stableHash(key)}`;

export function buildImportPayload(input: {
  rows: readonly ImportRow[];
  client: Client;
  destination: ImportPayload["client"];
  account: { externalId: string | null; name: string | null };
  record: ImportPayload["import"];
}): ImportPayload {
  const normalized = normalizeImport(input.rows, input.client, input.account, sourceKey);
  // Platform IDs per source key, kept alongside our keys for later API sync.
  const external = new Map<string, string | null>();
  for (const row of input.rows) {
    const keys = identityKeys(row);
    external.set(sourceKey("cmp", keys.campaign), row.campaign.id);
    external.set(sourceKey("set", keys.adSet), row.adSet.id);
    external.set(sourceKey("ad", keys.ad), row.ad.id);
    external.set(sourceKey("cr", keys.creative), row.creative.id);
  }
  const ext = (key: string) => external.get(key) ?? null;
  return {
    client: input.destination,
    account: { external_id: input.account.externalId, name: normalized.adAccount.name },
    campaigns: normalized.campaigns.map((c) => ({
      key: c.id,
      external_id: ext(c.id),
      name: c.name,
      objective: c.objective,
      status: c.status,
    })),
    ad_sets: normalized.adSets.map((s) => ({
      key: s.id,
      campaign_key: s.campaignId,
      external_id: ext(s.id),
      name: s.name,
      status: s.status,
    })),
    creatives: normalized.creatives.map((c) => ({
      key: c.id,
      external_id: ext(c.id),
      name: c.name,
      type: c.type,
    })),
    ads: normalized.ads.map((a) => ({
      key: a.id,
      ad_set_key: a.adSetId,
      creative_key: a.creativeId,
      external_id: ext(a.id),
      name: a.name,
      status: a.status,
    })),
    metrics: normalized.dailyMetrics.map((m) => ({
      ad_key: m.entityId,
      date: m.date,
      spend: m.spend,
      revenue: m.revenue,
      conversions: m.conversions,
      impressions: m.impressions,
      clicks: m.clicks,
    })),
    import: input.record,
  };
}

import { buildSeedDataset } from "@/data/seed";
import { addDays } from "@/domain/periods";
import type { CampaignObjective, IsoDate } from "@/domain/types";

/**
 * The audit's sample export (D-083): fourteen days of the demo's Luxe Skin
 * Co. seed data at ad level, by day, written with Ads Manager's column names.
 * It is generated, never edited by hand: `sample.test.ts` fails when the file
 * in `public/` no longer matches. The account name says it is sample data.
 */

export { SAMPLE_FILE_NAME, SAMPLE_PATH } from "./sample-path";
/** A fixed last day, so the committed file never changes on its own. */
export const SAMPLE_ANCHOR: IsoDate = "2026-09-30";
export const SAMPLE_DAYS = 14;
export const SAMPLE_ACCOUNT_NAME = "Luxe Skin Co. (sample data)";

const OBJECTIVES: Record<CampaignObjective, string> = {
  sales: "OUTCOME_SALES",
  leads: "OUTCOME_LEADS",
  traffic: "OUTCOME_TRAFFIC",
  awareness: "OUTCOME_AWARENESS",
  engagement: "OUTCOME_ENGAGEMENT",
};

const HEADERS = [
  "Reporting starts",
  "Reporting ends",
  "Day",
  "Account ID",
  "Account name",
  "Campaign name",
  "Campaign ID",
  "Campaign delivery",
  "Objective",
  "Ad set name",
  "Ad set ID",
  "Ad set delivery",
  "Ad name",
  "Ad ID",
  "Ad delivery",
  "Amount spent (GBP)",
  "Impressions",
  "Link clicks",
  "Purchases",
  "Purchases conversion value (GBP)",
] as const;

const quote = (value: string) =>
  /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

export function buildSampleCsv(): string {
  const dataset = buildSeedDataset({ anchorDate: SAMPLE_ANCHOR });
  const client = dataset.clients.find((c) => c.name === "Luxe Skin Co.");
  if (!client) throw new Error("The seed no longer has Luxe Skin Co.");
  const account = dataset.adAccounts.find((a) => a.clientId === client.id)!;
  const campaigns = new Map(
    dataset.campaigns.filter((c) => c.clientId === client.id).map((c) => [c.id, c]),
  );
  const adSets = new Map(
    dataset.adSets.filter((s) => campaigns.has(s.campaignId)).map((s) => [s.id, s]),
  );
  const ads = new Map(dataset.ads.filter((a) => adSets.has(a.adSetId)).map((a) => [a.id, a]));
  const first = addDays(SAMPLE_ANCHOR, -(SAMPLE_DAYS - 1));
  const rows = dataset.dailyMetrics
    .filter((m) => ads.has(m.entityId) && m.date >= first && m.date <= SAMPLE_ANCHOR)
    .sort((a, b) => a.date.localeCompare(b.date) || a.entityId.localeCompare(b.entityId))
    .map((m) => {
      const ad = ads.get(m.entityId)!;
      const adSet = adSets.get(ad.adSetId)!;
      const campaign = campaigns.get(adSet.campaignId)!;
      return [
        m.date,
        m.date,
        m.date,
        account.externalId,
        SAMPLE_ACCOUNT_NAME,
        campaign.name,
        campaign.id,
        campaign.status,
        campaign.objective ? OBJECTIVES[campaign.objective] : "",
        adSet.name,
        adSet.id,
        adSet.status,
        ad.name,
        ad.id,
        ad.status,
        m.spend.toFixed(2),
        String(m.impressions),
        String(m.clicks),
        String(m.conversions),
        m.revenue.toFixed(2),
      ];
    });
  return [HEADERS, ...rows].map((row) => row.map(quote).join(",")).join("\n") + "\n";
}

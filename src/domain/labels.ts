import type {
  CampaignObjective,
  Client,
  ClientType,
  CreativeType,
  EntityStatus,
  MetricKey,
} from "./types";

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  ecommerce: "Ecommerce",
  lead_generation: "Local lead generation",
  saas: "SaaS",
};

export const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  sales: "Sales",
  leads: "Leads",
  traffic: "Traffic",
  awareness: "Awareness",
  engagement: "Engagement",
};

export const STATUS_LABELS: Record<EntityStatus, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export const CREATIVE_TYPE_LABELS: Record<CreativeType, string> = {
  image: "Image",
  video: "Video",
  carousel: "Carousel",
  unknown: "Format unknown",
};

export interface ConversionVocabulary {
  singular: string;
  plural: string;
  costLabel: string;
}

/** What a "conversion" means for each kind of client. */
export function conversionVocabulary(type: ClientType): ConversionVocabulary {
  switch (type) {
    case "ecommerce":
      return { singular: "Purchase", plural: "Purchases", costLabel: "Cost per purchase" };
    case "lead_generation":
      return { singular: "Lead", plural: "Leads", costLabel: "Cost per lead" };
    case "saas":
      return { singular: "Trial", plural: "Trials", costLabel: "Cost per trial" };
  }
}

/** Headline KPIs for the Overview page, in display order. */
export function primaryMetricKeys(client: Client): MetricKey[] {
  switch (client.type) {
    case "ecommerce":
      return tracksRevenue(client)
        ? ["spend", "revenue", "conversions", "cpa", "roas", "ctr"]
        : ["spend", "conversions", "cpa", "ctr", "cpc", "cpm"];
    case "lead_generation":
      return ["spend", "conversions", "cpa", "ctr", "cpc", "cpm"];
    case "saas":
      return client.targetRoas === null
        ? ["spend", "conversions", "cpa", "ctr", "cpc", "cpm"]
        : ["spend", "revenue", "conversions", "cpa", "roas", "ctr"];
  }
}

/** Whether revenue-based metrics are meaningful for the client. */
export function tracksRevenue(client: Client): boolean {
  if (client.revenueTracked !== undefined) return client.revenueTracked;
  return client.type === "ecommerce" || client.targetRoas !== null;
}

export interface CampaignNameParts {
  /** The last segment: what the campaign is about ("Autumn Reset Sale"). */
  primary: string;
  /** The earlier segments joined with " · " ("Prospecting · Advantage+ Shopping"), or null. */
  context: string | null;
}

/**
 * Meta campaign names are often pipe-separated, broadest first
 * ("Prospecting | Advantage+ Shopping | Autumn Reset Sale"). The last segment
 * identifies the campaign; the rest is context. A name without at least two
 * non-empty segments is returned whole.
 */
export function splitCampaignName(name: string): CampaignNameParts {
  const segments = name
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length < 2) return { primary: name, context: null };
  return {
    primary: segments[segments.length - 1],
    context: segments.slice(0, -1).join(" · "),
  };
}

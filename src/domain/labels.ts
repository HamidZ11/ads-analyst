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
      return ["spend", "revenue", "conversions", "cpa", "roas", "ctr"];
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
  return client.type === "ecommerce" || client.targetRoas !== null;
}

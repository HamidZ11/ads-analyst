/**
 * Core domain model for Ad Analyst.
 *
 * Hierarchy: Agency → Client → AdAccount → Campaign → AdSet → Ad → Creative.
 * Daily metrics are stored at the leaf (ad) level only; every other level is
 * derived by aggregation so nothing is stored redundantly.
 */

/** Calendar date in ISO `YYYY-MM-DD` form, interpreted in the client's timezone. */
export type IsoDate = string;

export type CurrencyCode = "GBP" | "USD" | "EUR";

export type ClientType = "ecommerce" | "lead_generation" | "saas";

export type EntityStatus = "active" | "paused" | "archived";

export type CampaignObjective = "sales" | "leads" | "traffic" | "awareness" | "engagement";

export type CreativeType = "image" | "video" | "carousel";

export type AdPlatform = "meta";

/** The entity a `DailyMetrics` row is recorded against. */
export type MetricEntityType = "ad_account" | "campaign" | "ad_set" | "ad";

export interface Agency {
  id: string;
  name: string;
}

export interface Client {
  id: string;
  agencyId: string;
  name: string;
  type: ClientType;
  currency: CurrencyCode;
  timezone: string;
  /** Target cost per conversion in the client's currency. */
  targetCpa: number;
  /** Target return on ad spend as a multiple (3.5 = 3.5x). Null when not a primary goal. */
  targetRoas: number | null;
}

export interface AdAccount {
  id: string;
  clientId: string;
  platform: AdPlatform;
  name: string;
  /** Platform-side identifier, e.g. `act_1029384756`. */
  externalId: string;
  currency: CurrencyCode;
}

export interface Campaign {
  id: string;
  adAccountId: string;
  clientId: string;
  name: string;
  objective: CampaignObjective;
  status: EntityStatus;
}

export interface AdSet {
  id: string;
  campaignId: string;
  name: string;
  /** Human-readable targeting summary, e.g. "Broad · UK · 25–54". */
  audience: string;
  status: EntityStatus;
}

export interface Ad {
  id: string;
  adSetId: string;
  name: string;
  creativeId: string;
  status: EntityStatus;
}

export type ThumbnailTone = "sand" | "stone" | "mist" | "moss" | "clay" | "slate" | "dusk";

export type ThumbnailAspect = "1:1" | "4:5" | "9:16";

/**
 * The kind of composition a placeholder suggests, so a grid of demo creatives
 * reads as distinct pieces of work. Rendered as abstract shapes only.
 */
export type ThumbnailMotif =
  | "ugc"
  | "talking-head"
  | "product"
  | "before-after"
  | "carousel"
  | "clinical"
  | "testimonial"
  | "offer"
  | "catalogue"
  | "routine"
  | "screen";

/**
 * Creative imagery reference. Phase 01 ships generated placeholders; a future
 * `kind: "image"` variant will carry a URL to an imported asset.
 */
export interface CreativeThumbnail {
  kind: "placeholder";
  tone: ThumbnailTone;
  aspect: ThumbnailAspect;
  motif: ThumbnailMotif;
}

export interface Creative {
  id: string;
  clientId: string;
  name: string;
  type: CreativeType;
  thumbnail: CreativeThumbnail;
  headline: string;
  primaryText: string;
  callToAction: string;
}

/** One day of raw, additive metrics for a single entity. */
export interface DailyMetrics {
  date: IsoDate;
  entityType: MetricEntityType;
  entityId: string;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
}

/** The additive subset of `DailyMetrics`. */
export type MetricTotals = Pick<
  DailyMetrics,
  "spend" | "revenue" | "conversions" | "impressions" | "clicks"
>;

/** Ratios computed on demand from `MetricTotals`; null when undefined (zero denominator). */
export interface DerivedMetrics {
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  cpa: number | null;
  roas: number | null;
  conversionRate: number | null;
}

export type TotalMetricKey = keyof MetricTotals;
export type DerivedMetricKey = keyof DerivedMetrics;
export type MetricKey = TotalMetricKey | DerivedMetricKey;

export interface DateRange {
  /** Inclusive start date. */
  start: IsoDate;
  /** Inclusive end date. */
  end: IsoDate;
}

/** A complete, self-consistent dataset for one agency. */
export interface Dataset {
  agency: Agency;
  clients: Client[];
  adAccounts: AdAccount[];
  campaigns: Campaign[];
  adSets: AdSet[];
  ads: Ad[];
  creatives: Creative[];
  dailyMetrics: DailyMetrics[];
}

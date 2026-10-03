import type {
  CampaignObjective,
  ClientType,
  CreativeType,
  CurrencyCode,
  EntityStatus,
} from "@/domain/types";
import type { ColumnMapping, ImportFieldKey } from "./fields";

/**
 * The Meta Ads Manager adapter: header vocabulary and value vocabularies for
 * exports from "Export table data". Everything Meta-specific lives here; the
 * validator and normaliser only see canonical fields.
 */

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = ["GBP", "USD", "EUR"];

export function isSupportedCurrency(code: string): code is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

/** "Amount spent (GBP)" → key "amount spent", currency "GBP". */
export function normalizeHeader(header: string): { key: string; currency: string | null } {
  let text = header.replace(/^﻿/, "").trim();
  let currency: string | null = null;
  // Meta writes currency suffixes in capitals ("Amount spent (GBP)"); a lower-case
  // suffix such as "Clicks (all)" is part of the name, not a currency.
  const suffix = /\(([A-Z]{3})\)\s*$/.exec(text);
  if (suffix) {
    currency = suffix[1];
    text = text.slice(0, suffix.index);
  }
  const key = text
    .toLowerCase()
    .replace(/[‘’“”"']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return { key, currency };
}

/** Aliases in priority order, already normalised. */
const FIELD_ALIASES: ReadonlyArray<[ImportFieldKey, readonly string[]]> = [
  ["date", ["day", "date", "reporting date"]],
  ["reportingEnd", ["reporting ends", "reporting end", "end date"]],
  ["accountId", ["account id", "ad account id"]],
  ["accountName", ["account name", "ad account name"]],
  ["currency", ["currency", "account currency"]],
  ["campaignId", ["campaign id"]],
  ["campaignName", ["campaign name", "campaign"]],
  ["adSetId", ["ad set id", "adset id"]],
  ["adSetName", ["ad set name", "adset name", "ad set"]],
  ["adId", ["ad id"]],
  ["adName", ["ad name", "ad"]],
  ["campaignStatus", ["campaign delivery", "campaign status", "campaign effective status"]],
  ["adSetStatus", ["ad set delivery", "ad set status", "adset delivery", "adset status"]],
  ["adStatus", ["ad delivery", "ad status", "delivery", "ad effective status"]],
  ["objective", ["objective", "campaign objective"]],
  ["spend", ["amount spent", "spend", "cost"]],
  ["impressions", ["impressions"]],
  ["clicks", ["link clicks", "clicks all", "clicks"]],
  ["resultIndicator", ["result indicator", "result type"]],
  ["creativeId", ["creative id", "ad creative id"]],
  ["creativeName", ["creative name", "ad creative name"]],
  ["creativeFormat", ["ad format", "creative format", "creative type", "format"]],
];

export type OutcomeKind =
  "purchase" | "lead" | "trial" | "registration" | "subscription" | "results" | "conversions";

const OUTCOME_ALIASES: ReadonlyArray<[string, OutcomeKind]> = [
  ["purchases", "purchase"],
  ["website purchases", "purchase"],
  ["meta purchases", "purchase"],
  ["on facebook purchases", "purchase"],
  ["in app purchases", "purchase"],
  ["leads", "lead"],
  ["website leads", "lead"],
  ["meta leads", "lead"],
  ["on facebook leads", "lead"],
  ["leads form", "lead"],
  ["trials started", "trial"],
  ["website trials started", "trial"],
  ["registrations completed", "registration"],
  ["website registrations completed", "registration"],
  ["subscriptions", "subscription"],
  ["website subscriptions", "subscription"],
  ["results", "results"],
  ["conversions", "conversions"],
  ["website conversions", "conversions"],
];

const REVENUE_ALIASES: readonly string[] = [
  "purchases conversion value",
  "purchase conversion value",
  "website purchases conversion value",
  "website purchase conversion value",
  "meta purchase conversion value",
  "conversion value",
  "total conversion value",
  "purchase value",
];

/** Present in exports but deliberately not imported, with the reason shown in Inspect. */
const NOT_IMPORTED: ReadonlyArray<[RegExp, string]> = [
  [/^(ctr|cpc|cpm|cpp|frequency)\b/, "Derived from imported totals"],
  [/^cost per /, "Derived from imported totals"],
  [/roas\b|return on ad spend/, "Derived from imported totals"],
  [/^reach$/, "Not additive across days"],
  [/^reporting starts$/, "Start of the row's date range"],
  [
    /^(attribution setting|ends|starts|budget|ad set budget|ad set budget type|bid|bid type|last significant edit|quality ranking|engagement rate ranking|conversion rate ranking)\b/,
    "Not used by Ad Analyst",
  ],
];

/** Breakdown columns split one ad-day across several rows; those rows are summed. */
const BREAKDOWNS: readonly string[] = [
  "age",
  "gender",
  "placement",
  "platform",
  "publisher platform",
  "device platform",
  "impression device",
  "region",
  "country",
  "dma region",
  "time of day viewer s time zone",
  "time of day ad account time zone",
];

export type ColumnRole =
  | { kind: "field"; field: ImportFieldKey }
  | { kind: "outcome"; outcome: OutcomeKind }
  | { kind: "revenue" }
  | { kind: "breakdown" }
  | { kind: "not_imported"; reason: string }
  | { kind: "unknown" };

export interface InspectedColumn {
  index: number;
  header: string;
  key: string;
  currency: string | null;
  role: ColumnRole;
}

export interface Inspection {
  columns: InspectedColumn[];
  /** Enough Meta-specific headers to call it a Meta export. */
  likelyMeta: boolean;
  /** Distinct currency codes stated in headers, e.g. "Amount spent (GBP)". */
  headerCurrencies: string[];
  outcomes: InspectedColumn[];
  revenues: InspectedColumn[];
  breakdowns: InspectedColumn[];
  dateMode: "day" | "reporting_range" | "none";
}

const META_MARKERS = [
  "amount spent",
  "ad set name",
  "reporting starts",
  "reporting ends",
  "ad set id",
  "link clicks",
  "results",
  "result indicator",
  "campaign delivery",
];

export function inspectHeaders(headers: readonly string[]): Inspection {
  const used = new Set<number>();
  const columns: InspectedColumn[] = headers.map((header, index) => {
    const { key, currency } = normalizeHeader(header);
    return { index, header, key, currency, role: { kind: "unknown" } };
  });
  for (const column of columns) {
    const outcome = OUTCOME_ALIASES.find(([alias]) => alias === column.key);
    if (outcome) column.role = { kind: "outcome", outcome: outcome[1] };
    else if (REVENUE_ALIASES.includes(column.key)) column.role = { kind: "revenue" };
    else if (BREAKDOWNS.includes(column.key)) column.role = { kind: "breakdown" };
  }
  for (const [field, aliases] of FIELD_ALIASES) {
    for (const alias of aliases) {
      const column = columns.find(
        (c) => c.key === alias && c.role.kind === "unknown" && !used.has(c.index),
      );
      if (column) {
        column.role = { kind: "field", field };
        used.add(column.index);
        break;
      }
    }
  }
  for (const column of columns) {
    if (column.role.kind !== "unknown") continue;
    const reason = NOT_IMPORTED.find(([pattern]) => pattern.test(column.key));
    if (reason) column.role = { kind: "not_imported", reason: reason[1] };
  }
  const has = (key: string) => columns.some((c) => c.key === key);
  const fieldColumn = (field: ImportFieldKey) =>
    columns.find((c) => c.role.kind === "field" && c.role.field === field);
  const dateMode = fieldColumn("date")
    ? "day"
    : has("reporting starts")
      ? "reporting_range"
      : "none";
  return {
    columns,
    likelyMeta: META_MARKERS.filter(has).length >= 2,
    headerCurrencies: [
      ...new Set(columns.map((c) => c.currency).filter((c): c is string => c !== null)),
    ],
    outcomes: columns.filter((c) => c.role.kind === "outcome"),
    revenues: columns.filter((c) => c.role.kind === "revenue"),
    breakdowns: columns.filter((c) => c.role.kind === "breakdown"),
    dateMode,
  };
}

const OUTCOME_PREFERENCE: Record<ClientType, readonly OutcomeKind[]> = {
  ecommerce: ["purchase"],
  lead_generation: ["lead"],
  saas: ["trial", "registration", "subscription"],
};

/**
 * The business type an export points to, from its outcome columns: Purchases
 * → ecommerce, Leads → lead generation, Trials / Registrations / Subscriptions
 * → SaaS. Null when the export has none of these or more than one kind.
 */
export function inferBusinessType(inspection: Inspection): ClientType | null {
  const types = new Set<ClientType>();
  for (const column of inspection.outcomes) {
    if (column.role.kind !== "outcome") continue;
    for (const [type, kinds] of Object.entries(OUTCOME_PREFERENCE) as Array<
      [ClientType, readonly OutcomeKind[]]
    >)
      if (kinds.includes(column.role.outcome)) types.add(type);
  }
  return types.size === 1 ? [...types][0] : null;
}

/**
 * Proposes a mapping. Identity, date, delivery and metric fields map by alias
 * and need no confirmation. The primary conversion is preselected only when
 * the export has an unambiguous column for the business type; a generic
 * "Results" or "Conversions" column is offered but never chosen silently,
 * because it can count different events per campaign.
 */
export function proposeMapping(
  inspection: Inspection,
  businessType: ClientType,
): { mapping: ColumnMapping; outcomeNote: string | null } {
  const mapping: ColumnMapping = {};
  for (const column of inspection.columns)
    if (column.role.kind === "field") mapping[column.role.field] = column.index;
  if (mapping.date === undefined && inspection.dateMode === "reporting_range") {
    const starts = inspection.columns.find((c) => c.key === "reporting starts");
    if (starts) mapping.date = starts.index;
  }
  const preferred = OUTCOME_PREFERENCE[businessType];
  const specific = inspection.outcomes.find(
    (c) => c.role.kind === "outcome" && preferred.includes(c.role.outcome),
  );
  const generic = inspection.outcomes.find(
    (c) =>
      c.role.kind === "outcome" &&
      (c.role.outcome === "results" || c.role.outcome === "conversions"),
  );
  let outcomeNote: string | null = null;
  if (specific) mapping.conversions = specific.index;
  else if (generic)
    outcomeNote = `“${generic.header}” can count different events per campaign, so choose the column that counts this client's conversions.`;
  else if (inspection.outcomes.length > 0)
    outcomeNote =
      "None of the outcome columns matches this business type. Choose the primary conversion.";
  else
    outcomeNote =
      "No conversion column was recognised. Choose the column that counts conversions.";
  const revenue = inspection.revenues[0];
  if (revenue && businessType !== "lead_generation") mapping.revenue = revenue.index;
  return { mapping, outcomeNote };
}

/** Meta delivery and status values → the product's entity status. */
export function parseDelivery(value: string): EntityStatus | null {
  const v = value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (v === "") return null;
  if (
    v === "active" ||
    v === "learning" ||
    v === "learning_limited" ||
    v === "in_review_active"
  )
    return "active";
  if (v === "archived" || v === "deleted") return "archived";
  if (
    [
      "inactive",
      "not_delivering",
      "paused",
      "off",
      "campaign_off",
      "ad_set_off",
      "adset_off",
      "campaign_paused",
      "adset_paused",
      "completed",
      "rejected",
      "recently_rejected",
      "pending_review",
      "in_review",
      "with_issues",
      "error",
    ].includes(v)
  )
    return "paused";
  return null;
}

/** Meta objective names, legacy and ODAX, → the product's objectives. */
export function parseObjective(value: string): CampaignObjective | null {
  const v = value
    .trim()
    .toLowerCase()
    .replace(/^outcome_/, "")
    .replace(/[\s-]+/g, "_");
  if (v === "") return null;
  if (
    ["sales", "conversions", "product_catalog_sales", "catalog_sales", "store_visits"].includes(
      v,
    )
  )
    return "sales";
  if (["leads", "lead_generation", "lead_gen"].includes(v)) return "leads";
  if (["traffic", "link_clicks"].includes(v)) return "traffic";
  if (["awareness", "brand_awareness", "reach", "video_views"].includes(v)) return "awareness";
  if (
    ["engagement", "post_engagement", "page_likes", "messages", "event_responses"].includes(v)
  )
    return "engagement";
  return null;
}

/** Ad format values → creative type; anything unrecognised stays unknown. */
export function parseCreativeFormat(value: string): CreativeType {
  const v = value.trim().toLowerCase();
  if (/carousel/.test(v)) return "carousel";
  if (/video|reel/.test(v)) return "video";
  if (/image|photo|static/.test(v)) return "image";
  return "unknown";
}

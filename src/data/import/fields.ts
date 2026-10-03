/**
 * The canonical import fields: what any tabular ad-platform export must
 * provide (or may provide) to become Ad Analyst's normalised model. Source
 * adapters (Meta CSV today) only decide which column fills which field.
 */

export type ImportFieldKey =
  | "date"
  | "reportingEnd"
  | "accountId"
  | "accountName"
  | "currency"
  | "campaignId"
  | "campaignName"
  | "adSetId"
  | "adSetName"
  | "adId"
  | "adName"
  | "campaignStatus"
  | "adSetStatus"
  | "adStatus"
  | "objective"
  | "spend"
  | "impressions"
  | "clicks"
  | "conversions"
  | "revenue"
  | "resultIndicator"
  | "creativeId"
  | "creativeName"
  | "creativeFormat";

/**
 * `required` must be mapped; `identity` fields come in ID/name pairs where at
 * least one of the pair is required; `optional` fields add detail.
 */
export type FieldRequirement = "required" | "identity" | "optional";

export interface ImportField {
  key: ImportFieldKey;
  label: string;
  requirement: FieldRequirement;
  group: "Date" | "Account" | "Structure" | "Delivery" | "Metrics" | "Creative";
  /** For identity pairs, the other half. */
  pair?: ImportFieldKey;
  hint?: string;
}

export const IMPORT_FIELDS: readonly ImportField[] = [
  {
    key: "date",
    label: "Date",
    requirement: "required",
    group: "Date",
    hint: "One day per row (Meta's Day breakdown).",
  },
  {
    key: "reportingEnd",
    label: "Reporting ends",
    requirement: "optional",
    group: "Date",
    hint: "Checked against the date so multi-day rows are refused.",
  },
  { key: "accountId", label: "Account ID", requirement: "optional", group: "Account" },
  { key: "accountName", label: "Account name", requirement: "optional", group: "Account" },
  {
    key: "currency",
    label: "Currency",
    requirement: "optional",
    group: "Account",
    hint: "A currency column, when the export has one.",
  },
  {
    key: "campaignId",
    label: "Campaign ID",
    requirement: "identity",
    group: "Structure",
    pair: "campaignName",
  },
  {
    key: "campaignName",
    label: "Campaign name",
    requirement: "identity",
    group: "Structure",
    pair: "campaignId",
  },
  {
    key: "adSetId",
    label: "Ad set ID",
    requirement: "identity",
    group: "Structure",
    pair: "adSetName",
  },
  {
    key: "adSetName",
    label: "Ad set name",
    requirement: "identity",
    group: "Structure",
    pair: "adSetId",
  },
  { key: "adId", label: "Ad ID", requirement: "identity", group: "Structure", pair: "adName" },
  {
    key: "adName",
    label: "Ad name",
    requirement: "identity",
    group: "Structure",
    pair: "adId",
  },
  {
    key: "campaignStatus",
    label: "Campaign delivery",
    requirement: "optional",
    group: "Delivery",
  },
  { key: "adSetStatus", label: "Ad set delivery", requirement: "optional", group: "Delivery" },
  { key: "adStatus", label: "Ad delivery", requirement: "optional", group: "Delivery" },
  { key: "objective", label: "Objective", requirement: "optional", group: "Delivery" },
  { key: "spend", label: "Spend", requirement: "required", group: "Metrics" },
  { key: "impressions", label: "Impressions", requirement: "required", group: "Metrics" },
  {
    key: "clicks",
    label: "Clicks",
    requirement: "required",
    group: "Metrics",
    hint: "Link clicks where available.",
  },
  {
    key: "conversions",
    label: "Primary conversion",
    requirement: "required",
    group: "Metrics",
    hint: "The outcome this client is judged on.",
  },
  {
    key: "revenue",
    label: "Conversion value",
    requirement: "optional",
    group: "Metrics",
    hint: "Revenue for ROAS; leave unmapped if not tracked.",
  },
  {
    key: "resultIndicator",
    label: "Result indicator",
    requirement: "optional",
    group: "Metrics",
    hint: "Used to check that Results counts one kind of event.",
  },
  { key: "creativeId", label: "Creative ID", requirement: "optional", group: "Creative" },
  { key: "creativeName", label: "Creative name", requirement: "optional", group: "Creative" },
  {
    key: "creativeFormat",
    label: "Creative format",
    requirement: "optional",
    group: "Creative",
  },
];

export const IMPORT_FIELD_KEYS: readonly ImportFieldKey[] = IMPORT_FIELDS.map((f) => f.key);

export const FIELD_BY_KEY: ReadonlyMap<ImportFieldKey, ImportField> = new Map(
  IMPORT_FIELDS.map((f) => [f.key, f]),
);

/** Field → column index. Only canonical keys ever become properties. */
export type ColumnMapping = Partial<Record<ImportFieldKey, number>>;

/**
 * Rebuilds a mapping from untrusted input (a request body): only known field
 * keys, only integer column indexes inside the header. Anything else is dropped,
 * so header text or injected keys never become object properties.
 */
export function sanitizeMapping(input: unknown, columnCount: number): ColumnMapping {
  const mapping: ColumnMapping = {};
  if (typeof input !== "object" || input === null || Array.isArray(input)) return mapping;
  for (const key of IMPORT_FIELD_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;
    const value = (input as Record<string, unknown>)[key];
    if (
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value < columnCount
    )
      mapping[key] = value;
  }
  return mapping;
}

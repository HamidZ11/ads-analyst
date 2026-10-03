import {
  IMPORT_FIELDS,
  cleanText,
  columnKind,
  inferBusinessType,
  inspectHeaders,
  isSupportedCurrency,
  parseDate,
  proposeMapping,
  type ColumnKind,
  type ColumnMapping,
  type CsvTable,
  type ImportField,
  type ImportFieldKey,
  type Inspection,
} from "@/data/import";
import type { ClientType, CurrencyCode, IsoDate } from "@/domain/types";

/**
 * The setup step's model, kept pure so it can be tested without a browser:
 * what the file was recognised as, the proposed mapping, and what (if
 * anything) still needs a person. Validation and import are unchanged.
 */

export interface DetectedFile {
  likelyMeta: boolean;
  /** A single supported currency stated by the file, if any. */
  currency: CurrencyCode | null;
  /** Everything the file states, supported or not. */
  currencies: string[];
  firstDate: IsoDate | null;
  lastDate: IsoDate | null;
  days: number;
  rows: number;
  campaigns: number;
  adSets: number;
  ads: number;
  /** One row per day (a Day column, or matching Reporting starts/ends). */
  daily: boolean;
  outcomeHeaders: string[];
  revenueHeaders: string[];
}

export interface ImportSetup {
  inspection: Inspection;
  kinds: ColumnKind[];
  /** Suggested from the outcome columns; null when the file does not say. */
  suggestedType: ClientType | null;
  businessType: ClientType;
  mapping: ColumnMapping;
  outcomeNote: string | null;
  detected: DetectedFile;
}

/** Fields shown in the main setup form rather than in advanced mapping. */
export const SETUP_FIELDS: ReadonlySet<ImportFieldKey> = new Set(["conversions", "revenue"]);

export const ADVANCED_FIELDS: readonly ImportField[] = IMPORT_FIELDS.filter(
  (f) => !SETUP_FIELDS.has(f.key),
);

const NUMERIC: ReadonlySet<ImportFieldKey> = new Set([
  "spend",
  "impressions",
  "clicks",
  "conversions",
  "revenue",
]);
const DATES: ReadonlySet<ImportFieldKey> = new Set(["date", "reportingEnd"]);

export function detectFile(
  table: CsvTable,
  inspection: Inspection,
  mapping: ColumnMapping,
): DetectedFile {
  const at = (row: string[], field: ImportFieldKey) => {
    const index = mapping[field];
    return index === undefined ? "" : cleanText(row[index] ?? "");
  };
  const campaigns = new Set<string>();
  const adSets = new Set<string>();
  const ads = new Set<string>();
  const dates = new Set<string>();
  const rowCurrencies = new Set<string>();
  for (const row of table.rows) {
    const campaign = at(row, "campaignId") || at(row, "campaignName");
    const adSet = at(row, "adSetId") || `${campaign}/${at(row, "adSetName")}`;
    const ad = at(row, "adId") || `${adSet}/${at(row, "adName")}`;
    if (campaign) campaigns.add(campaign);
    if (campaign && adSet) adSets.add(adSet);
    if (campaign && ad) ads.add(ad);
    const date = parseDate(at(row, "date"));
    if (date) dates.add(date);
    const currency = at(row, "currency").toUpperCase();
    if (currency) rowCurrencies.add(currency);
  }
  const currencies = [...new Set([...inspection.headerCurrencies, ...rowCurrencies])];
  const sorted = [...dates].sort();
  return {
    likelyMeta: inspection.likelyMeta,
    currency:
      currencies.length === 1 && isSupportedCurrency(currencies[0]) ? currencies[0] : null,
    currencies,
    firstDate: sorted[0] ?? null,
    lastDate: sorted.at(-1) ?? null,
    days: dates.size,
    rows: table.rows.length,
    campaigns: campaigns.size,
    adSets: adSets.size,
    ads: ads.size,
    daily: inspection.dateMode !== "none",
    outcomeHeaders: inspection.outcomes.map((c) => c.header),
    revenueHeaders: inspection.revenues.map((c) => c.header),
  };
}

/** Inspect, suggest a business type and map: everything that needs no person. */
export function prepareImport(table: CsvTable, businessType?: ClientType): ImportSetup {
  const inspection = inspectHeaders(table.headers);
  const suggestedType = inferBusinessType(inspection);
  const type = businessType ?? suggestedType ?? "ecommerce";
  const { mapping, outcomeNote } = proposeMapping(inspection, type);
  return {
    inspection,
    kinds: table.headers.map((_, index) => columnKind(table, index)),
    suggestedType,
    businessType: type,
    mapping,
    outcomeNote,
    detected: detectFile(table, inspection, mapping),
  };
}

/** Required fields (or identity pairs) without a column. */
export function requiredGaps(mapping: ColumnMapping): ImportFieldKey[] {
  const gaps: ImportFieldKey[] = [];
  for (const field of ["date", "spend", "impressions", "clicks", "conversions"] as const)
    if (mapping[field] === undefined) gaps.push(field);
  for (const [id, name] of [
    ["campaignId", "campaignName"],
    ["adSetId", "adSetName"],
    ["adId", "adName"],
  ] as const)
    if (mapping[id] === undefined && mapping[name] === undefined) gaps.push(id);
  return gaps;
}

/** The status line beside the collapsed advanced mapping. */
export function mappingStatus(mapping: ColumnMapping): {
  mapped: number;
  missing: ImportFieldKey[];
  label: string;
} {
  const missing = requiredGaps(mapping).filter((f) => !SETUP_FIELDS.has(f));
  const mapped = Object.keys(mapping).length;
  return {
    mapped,
    missing,
    label: missing.length
      ? `${missing.length} required ${missing.length === 1 ? "field needs" : "fields need"} a column`
      : `All required fields matched automatically · ${mapped} columns used`,
  };
}

/**
 * Columns that can plausibly fill a field: numbers for metrics (recognised
 * outcome or value columns first), dates for dates, anything for names and
 * IDs. The current choice is always kept so nothing silently disappears.
 */
export function columnOptions(
  field: ImportFieldKey,
  kinds: readonly ColumnKind[],
  inspection: Inspection,
  current: number | undefined,
): number[] {
  const all = kinds.map((_, i) => i);
  const role = (i: number) => inspection.columns[i]?.role;
  // IDs are numeric but never metrics; ratios and reach are not additive counts.
  const notMetric = (i: number) => {
    const r = role(i);
    return r?.kind === "field" && !NUMERIC.has(r.field);
  };
  const otherMetric = (i: number) => {
    const r = role(i);
    return (
      (r?.kind === "field" && NUMERIC.has(r.field) && r.field !== field) ||
      r?.kind === "not_imported"
    );
  };
  let options = all;
  if (NUMERIC.has(field))
    options = all.filter(
      (i) =>
        (kinds[i] === "number" || kinds[i] === "empty") &&
        !notMetric(i) &&
        !((field === "conversions" || field === "revenue") && otherMetric(i)) &&
        !(field === "conversions" && role(i)?.kind === "revenue") &&
        !(field === "revenue" && role(i)?.kind === "outcome"),
    );
  else if (DATES.has(field)) options = all.filter((i) => kinds[i] === "date");
  const first =
    field === "conversions"
      ? inspection.outcomes.map((c) => c.index)
      : field === "revenue"
        ? inspection.revenues.map((c) => c.index)
        : [];
  const ordered = [
    ...first.filter((i) => options.includes(i)),
    ...options.filter((i) => !first.includes(i)),
  ];
  if (current !== undefined && !ordered.includes(current)) ordered.unshift(current);
  return ordered;
}

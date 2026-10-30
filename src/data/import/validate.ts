import { formatDate } from "@/domain/format";
import { isIsoDate } from "@/domain/periods";
import type {
  CampaignObjective,
  ClientType,
  CreativeType,
  CurrencyCode,
  EntityStatus,
  IsoDate,
} from "@/domain/types";
import type { CsvTable } from "./csv";
import { FIELD_BY_KEY, type ColumnMapping, type ImportFieldKey } from "./fields";
import {
  inspectHeaders,
  isSupportedCurrency,
  parseCreativeFormat,
  parseDelivery,
  parseObjective,
  type Inspection,
} from "./meta";

/* --------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------ */

export interface ImportTarget {
  clientName: string;
  currency: CurrencyCode;
  businessType: ClientType;
  /** Whether conversion value is imported for this client. */
  revenueTracked: boolean;
  /** Platform account ID already connected to the client, if any. */
  existingAccountId: string | null;
  /** Used to flag future-dated rows. */
  today: IsoDate;
}

export interface IssueSample {
  line: number;
  value?: string;
}

export interface ImportIssue {
  /** `error` blocks the import (genuine uncertainty); `warning` was handled and is disclosed. */
  level: "error" | "warning";
  code: string;
  message: string;
  field?: ImportFieldKey;
  /** Rows affected (0 when the issue is file-level). */
  count: number;
  /** Up to five representative rows. */
  samples: IssueSample[];
}

export interface Identity {
  id: string | null;
  name: string | null;
}

/** One ad on one day, after parsing, cleaning and duplicate handling. */
export interface ImportRow {
  /** First source line that contributed to this ad-day. */
  line: number;
  date: IsoDate;
  account: Identity;
  campaign: Identity;
  adSet: Identity;
  ad: Identity;
  creative: Identity;
  creativeFormat: CreativeType;
  campaignStatus: EntityStatus | null;
  adSetStatus: EntityStatus | null;
  adStatus: EntityStatus | null;
  objective: CampaignObjective | null;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  /** 0 when revenue is not tracked for the client. */
  revenue: number;
}

export interface ValidationResult {
  issues: ImportIssue[];
  errors: number;
  warnings: number;
  /** Ad-day rows ready to normalise; empty when there are errors. */
  rows: ImportRow[];
  /** Currency stated by the file, when it states one. */
  fileCurrency: CurrencyCode | null;
  accountId: string | null;
  accountName: string | null;
  sourceRows: number;
}

/* --------------------------------------------------------------------------
 * Value parsing
 * ------------------------------------------------------------------------ */

/**
 * How a file writes decimals. Ads Manager writes `1234.56`; a spreadsheet saved
 * in a European locale writes `1.234,56` (usually with `;` between fields).
 */
export type DecimalMark = "point" | "comma";

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
const GROUPED_NUMBER = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;
const PLAIN_COMMA_NUMBER = /^-?\d+(,\d+)?$/;
const GROUPED_COMMA_NUMBER = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/;
/** Thousands grouped with a space, a no-break space or a narrow no-break space. */
const SPACE_GROUPED = /^-?\d{1,3}([ \u00a0\u202f]\d{3})+([.,]\d+)?$/;

/**
 * Plain or thousands-grouped decimals only; no symbols, percentages or
 * exponents. With `comma`, the comma is the decimal mark and dots group.
 */
export function parseNumber(
  cell: string,
  decimal: DecimalMark = "point",
): number | null | "invalid" {
  const v = cell.trim();
  if (v === "" || v === "-" || v === "—") return null;
  if (SPACE_GROUPED.test(v)) {
    const digits = v.replace(/[ \u00a0\u202f]/g, "");
    const mark = digits.includes(",") ? "," : digits.includes(".") ? "." : null;
    if (mark && mark !== (decimal === "comma" ? "," : ".")) return "invalid";
    return Number(digits.replace(",", "."));
  }
  if (decimal === "comma") {
    if (PLAIN_COMMA_NUMBER.test(v)) return Number(v.replace(",", "."));
    if (GROUPED_COMMA_NUMBER.test(v)) return Number(v.replace(/\./g, "").replace(",", "."));
    return "invalid";
  }
  if (PLAIN_NUMBER.test(v)) return Number(v);
  if (GROUPED_NUMBER.test(v)) return Number(v.replace(/,/g, ""));
  return "invalid";
}

/** A comma decimal that cannot be a thousands separator: `12,5`, `12,50`, `1.234,56`. */
const COMMA_DECIMAL_EVIDENCE = /^-?(\d+,\d{1,2}|\d{1,3}(\.\d{3})+,\d+)$/;
/** A point decimal that cannot be a thousands separator: `12.5`, `12.50`, `1,234.56`. */
const POINT_DECIMAL_EVIDENCE = /^-?(\d+\.\d{1,2}|\d{1,3}(,\d{3})+\.\d+)$/;

/**
 * The decimal mark of the given columns. Comma only when some value can only
 * be read with a decimal comma and none can only be read with a decimal point;
 * otherwise the Ads Manager default, point.
 */
export function detectDecimalMark(table: CsvTable, columns: readonly number[]): DecimalMark {
  let comma = false;
  let point = false;
  for (const row of table.rows) {
    for (const index of columns) {
      const v = stripSymbol((row[index] ?? "").trim());
      if (COMMA_DECIMAL_EVIDENCE.test(v)) comma = true;
      else if (POINT_DECIMAL_EVIDENCE.test(v)) point = true;
    }
    if (comma && point) break;
  }
  return comma && !point ? "comma" : "point";
}

const SYMBOL_CURRENCY: Record<string, CurrencyCode> = { "£": "GBP", $: "USD", "€": "EUR" };

/** The currency symbol before or after an amount: `£1,234.56`, `-£5`, `12,50 €`. */
function splitSymbol(v: string): { sign: string; symbol: string; amount: string } | null {
  const leading = /^(-?)([£$€])\s?(.*)$/.exec(v);
  if (leading) return { sign: leading[1], symbol: leading[2], amount: leading[3] };
  const trailing = /^(-?)(.*?)\s?([£$€])$/.exec(v);
  if (trailing) return { sign: trailing[1], symbol: trailing[3], amount: trailing[2] };
  return null;
}

function stripSymbol(v: string): string {
  const parts = splitSymbol(v);
  return parts ? `${parts.sign}${parts.amount}` : v;
}

/** The currency named by a symbol on any of the cells, when they agree on one. */
export function symbolCurrency(cells: Iterable<string>): CurrencyCode | null | "mixed" {
  let found: CurrencyCode | null = null;
  for (const cell of cells) {
    const parts = splitSymbol(cell.trim());
    if (!parts) continue;
    const currency = SYMBOL_CURRENCY[parts.symbol];
    if (found && found !== currency) return "mixed";
    found = currency;
  }
  return found;
}

/**
 * An amount, allowing a currency symbol before or after it (as a spreadsheet
 * may add). The symbol is only removed when it names the import's currency; a
 * different symbol is reported, never converted.
 */
export function parseMoney(
  cell: string,
  currency: CurrencyCode,
  decimal: DecimalMark = "point",
): number | null | "invalid" | { symbol: string } {
  const v = cell.trim();
  const parts = splitSymbol(v);
  if (!parts) return parseNumber(v, decimal);
  if (SYMBOL_CURRENCY[parts.symbol] !== currency) return { symbol: parts.symbol };
  return parseNumber(`${parts.sign}${parts.amount}`, decimal);
}

/**
 * How a file writes its dates: ISO year first (Ads Manager's own format), or
 * day-first or month-first with slashes, dots or dashes, as a spreadsheet
 * saved in a British or American locale writes them.
 */
export type DateOrder = "ymd" | "dmy" | "mdy";

const ISO_DATE =
  /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const LOCAL_DATE = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/;

/**
 * Calendar dates, optionally followed by a time, which is ignored. With the
 * default `ymd`, only ISO dates: YYYY-MM-DD (or with slashes). With `dmy` or
 * `mdy`, also 17/09/2026 or 09/17/2026 read in that order. The date is taken
 * exactly as written: no Date parsing of the string and no timezone
 * conversion, so it cannot drift by a day.
 */
export function parseDate(cell: string, order: DateOrder = "ymd"): IsoDate | null {
  const v = cell.trim();
  let iso: string;
  const match = ISO_DATE.exec(v);
  if (match) iso = `${match[1]}-${match[2]}-${match[3]}`;
  else {
    const local = order === "ymd" ? null : LOCAL_DATE.exec(v);
    if (!local) return null;
    const [day, month] = order === "dmy" ? [local[1], local[2]] : [local[2], local[1]];
    iso = `${local[3]}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  if (!isIsoDate(iso)) return null;
  // Reject days the calendar does not have (2026-02-30 would otherwise roll over).
  const [y, m, d] = iso.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCFullYear() === y &&
    check.getUTCMonth() === m - 1 &&
    check.getUTCDate() === d
    ? iso
    : null;
}

/**
 * The order a file writes its dates in, from every value in the given
 * columns. ISO when every date is ISO. For slashed dates, a first part over
 * 12 means day first and a second part over 12 means month first. When every
 * date could be read either way, the reading that keeps the dates closest
 * together wins: a daily export covers consecutive days, so 01/10 to 14/10
 * is 1 to 14 October, not ten months. Null when the order can't be decided.
 */
export function detectDateOrder(values: Iterable<string>): DateOrder | null {
  const local: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v || ISO_DATE.test(v)) continue;
    if (LOCAL_DATE.test(v)) local.push(v);
  }
  if (local.length === 0) return "ymd";
  const fits = (order: DateOrder) => local.every((v) => parseDate(v, order) !== null);
  const dmy = fits("dmy");
  const mdy = fits("mdy");
  if (dmy !== mdy) return dmy ? "dmy" : "mdy";
  if (!dmy) return null;
  const span = (order: DateOrder) => {
    const dates = local.map((v) => parseDate(v, order)!).sort();
    return Date.parse(dates.at(-1)!) - Date.parse(dates[0]);
  };
  const [d, m] = [span("dmy"), span("mdy")];
  if (d !== m) return d < m ? "dmy" : "mdy";
  // Same span either way: only safe when every date reads the same (05/05/2026).
  return local.every((v) => parseDate(v, "dmy") === parseDate(v, "mdy")) ? "dmy" : null;
}

/** Strips control and bidirectional-override characters, collapses spaces, caps length. */
export function cleanText(value: string, max = 300): string {
  return value
    .replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export type ColumnKind = "number" | "date" | "text" | "empty";

/** What a column mostly holds, from up to 200 non-blank cells. */
export function columnKind(table: CsvTable, index: number): ColumnKind {
  let seen = 0;
  let numbers = 0;
  let dates = 0;
  for (const row of table.rows) {
    const value = (row[index] ?? "").trim();
    if (!value || value === "-" || value === "—") continue;
    seen += 1;
    if (parseDate(value) || parseDate(value, "dmy") || parseDate(value, "mdy")) dates += 1;
    else {
      const bare = stripSymbol(value).replace(/%$/, "");
      if (parseNumber(bare) !== "invalid" || parseNumber(bare, "comma") !== "invalid")
        numbers += 1;
    }
    if (seen >= 200) break;
  }
  if (seen === 0) return "empty";
  if (numbers / seen >= 0.5) return "number";
  if (dates / seen >= 0.5) return "date";
  return "text";
}

const SCIENTIFIC_ID = /^\d(\.\d+)?e\+?\d+$/i;
const FORMULA_LIKE = /^[=+\-@]/;

/** Stable identity keys shared by validation (duplicates) and normalisation (entity IDs). */
export function identityKeys(row: Pick<ImportRow, "campaign" | "adSet" | "ad" | "creative">) {
  const campaign = row.campaign.id ? `id:${row.campaign.id}` : `name:${row.campaign.name}`;
  const adSet = row.adSet.id ? `id:${row.adSet.id}` : `name:${campaign}/${row.adSet.name}`;
  const ad = row.ad.id ? `id:${row.ad.id}` : `name:${adSet}/${row.ad.name}`;
  const creative = row.creative.id
    ? `id:${row.creative.id}`
    : row.creative.name
      ? `name:${row.creative.name}`
      : `ad:${ad}`;
  return { campaign, adSet, ad, creative };
}

/**
 * Blockers the user can resolve in the setup step (a column choice or a
 * client setting), as opposed to blockers that live in the file itself.
 */
export function isSetupIssue(issue: Pick<ImportIssue, "code" | "level">): boolean {
  return (
    issue.level === "error" &&
    (/^(missing|wrong_column|same_column)_/.test(issue.code) ||
      issue.code === "mixed_results") &&
    !issue.code.startsWith("missing_value_")
  );
}

/* --------------------------------------------------------------------------
 * Issue collection
 * ------------------------------------------------------------------------ */

class Issues {
  private readonly map = new Map<string, ImportIssue>();
  private readonly messages = new Map<string, (count: number) => string>();

  add(
    level: ImportIssue["level"],
    code: string,
    message: string | ((count: number) => string),
    sample?: IssueSample,
    field?: ImportFieldKey,
  ) {
    const existing = this.map.get(code);
    if (existing) {
      existing.count += sample ? 1 : 0;
      if (sample && existing.samples.length < 5) existing.samples.push(sample);
      return;
    }
    if (typeof message === "function") this.messages.set(code, message);
    this.map.set(code, {
      level,
      code,
      message: typeof message === "function" ? "" : message,
      field,
      count: sample ? 1 : 0,
      samples: sample ? [sample] : [],
    });
  }

  hasErrors() {
    return [...this.map.values()].some((i) => i.level === "error");
  }

  list(): ImportIssue[] {
    const all = [...this.map.values()].map((issue) => {
      const render = this.messages.get(issue.code);
      return render ? { ...issue, message: render(issue.count) } : issue;
    });
    return [
      ...all.filter((i) => i.level === "error"),
      ...all.filter((i) => i.level === "warning"),
    ];
  }
}

const rowsWord = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "row" : "rows"}`;
const fieldName = (field: ImportFieldKey) => FIELD_BY_KEY.get(field)?.label ?? field;

/* --------------------------------------------------------------------------
 * Validation
 * ------------------------------------------------------------------------ */

const METRICS = ["spend", "impressions", "clicks", "conversions", "revenue"] as const;
type MetricField = (typeof METRICS)[number];
const MONEY: ReadonlySet<MetricField> = new Set(["spend", "revenue"]);

/**
 * Turns a parsed CSV and a column mapping into ad-day rows. Everything that
 * can be resolved safely is resolved and disclosed as a warning (blank results,
 * a matching currency symbol, repeated rows, breakdowns, summary rows, missing
 * optional columns). Only genuine uncertainty is an error: a column that
 * cannot hold the field, an unreadable value, conflicting currencies, accounts
 * or rows. Messages name the field, not the column, and never blame the user.
 */
export function validateImport(
  table: CsvTable,
  mapping: ColumnMapping,
  target: ImportTarget,
  inspection: Inspection = inspectHeaders(table.headers),
): ValidationResult {
  const issues = new Issues();
  const { headers } = table;
  const col = (field: ImportFieldKey) => mapping[field];
  const header = (field: ImportFieldKey) => headers[col(field)!];

  // 1. Column choices (resolvable in setup).
  for (const field of ["date", "spend", "impressions", "clicks"] as const)
    if (col(field) === undefined)
      issues.add(
        "error",
        `missing_${field}`,
        `We couldn't find a column for ${fieldName(field)}.`,
        undefined,
        field,
      );
  if (col("conversions") === undefined)
    issues.add(
      "error",
      "missing_conversions",
      "We couldn't determine the primary conversion. Choose the column that counts this client's conversions.",
      undefined,
      "conversions",
    );
  for (const [id, nm, what] of [
    ["campaignId", "campaignName", "campaign"],
    ["adSetId", "adSetName", "ad set"],
    ["adId", "adName", "ad"],
  ] as const)
    if (col(id) === undefined && col(nm) === undefined)
      issues.add(
        "error",
        `missing_${id}`,
        `We couldn't find a ${what} name or ID column.`,
        undefined,
        id,
      );

  const numericFields = METRICS.filter(
    (f) => col(f) !== undefined && (f !== "revenue" || target.revenueTracked),
  );
  for (let i = 0; i < numericFields.length; i += 1)
    for (let j = i + 1; j < numericFields.length; j += 1)
      if (col(numericFields[i]) === col(numericFields[j]))
        issues.add(
          "error",
          `same_column_${numericFields[j]}`,
          `${fieldName(numericFields[j])} and ${fieldName(numericFields[i])} point at the same column, “${header(numericFields[j])}”.`,
          undefined,
          numericFields[j],
        );
  // A number field pointed at a column of dates or names is a column choice,
  // not thousands of bad values.
  for (const field of numericFields) {
    const kind = columnKind(table, col(field)!);
    if (kind === "date" || kind === "text")
      issues.add(
        "error",
        `wrong_column_${field}`,
        `${fieldName(field)} is set to “${header(field)}”, which holds ${kind === "date" ? "dates" : "text"}, not numbers. Choose the column with the ${fieldName(field).toLowerCase()} figures.`,
        undefined,
        field,
      );
  }
  if (col("date") !== undefined) {
    const kind = columnKind(table, col("date")!);
    if (kind === "number" || kind === "text")
      issues.add(
        "error",
        "wrong_column_date",
        `Date is set to “${header("date")}”, which doesn't hold dates. Choose the column with one date per row, usually “Day”.`,
        undefined,
        "date",
      );
  }
  const importRevenue = target.revenueTracked && col("revenue") !== undefined;
  if (target.revenueTracked && col("revenue") === undefined)
    issues.add(
      "error",
      "missing_revenue",
      inspection.revenues.length
        ? `${target.clientName} records conversion value. Choose the conversion value column.`
        : `${target.clientName} records conversion value, but this file has none, so ROAS would be wrong. Import it into a client that doesn't track value.`,
      undefined,
      "revenue",
    );
  if (!target.revenueTracked && col("revenue") !== undefined)
    issues.add(
      "warning",
      "revenue_ignored",
      `Conversion value isn't imported because ${target.clientName} doesn't track it, so ROAS won't be shown.`,
    );

  // 2. Currency stated by the column headers.
  const headerCurrencies = inspection.headerCurrencies;
  const unsupportedHeader = headerCurrencies.filter((c) => !isSupportedCurrency(c));
  if (unsupportedHeader.length)
    issues.add(
      "error",
      "unsupported_currency",
      `This file is in ${unsupportedHeader.join(", ")}. Ad Analyst supports GBP, USD and EUR for now.`,
    );
  if (headerCurrencies.length > 1)
    issues.add(
      "error",
      "mixed_currency",
      `This file contains more than one currency (${headerCurrencies.join(" and ")}), so it can't be imported as one account.`,
    );

  // 3. How the file writes dates and decimals, decided once for the whole file.
  const dateColumns = (["date", "reportingEnd"] as const)
    .map((f) => col(f))
    .filter((i): i is number => i !== undefined);
  const dateOrder = detectDateOrder(
    table.rows.flatMap((row) => dateColumns.map((i) => row[i] ?? "")),
  );
  if (dateOrder === null) {
    const sample = table.rows.map((row) => (row[col("date")!] ?? "").trim()).find(Boolean);
    issues.add(
      "error",
      "ambiguous_date",
      `We can't tell whether dates such as “${sample}” put the day or the month first. Upload the file exactly as Ads Manager exported it, without opening and saving it in a spreadsheet.`,
      undefined,
      "date",
    );
  }
  const decimal = detectDecimalMark(
    table,
    numericFields.map((f) => col(f)!),
  );

  if (issues.hasErrors()) return summarise(issues, [], null, null, null, table.rows.length);

  // 4. Rows.
  const outcomeColumn = inspection.columns[col("conversions")!];
  const resultsLike =
    outcomeColumn?.role.kind === "outcome" &&
    (outcomeColumn.role.outcome === "results" || outcomeColumn.role.outcome === "conversions");
  const moneyCurrency =
    headerCurrencies.length === 1 && isSupportedCurrency(headerCurrencies[0])
      ? headerCurrencies[0]
      : target.currency;
  const rowCurrencies = new Set<string>();
  const accountIds = new Set<string>();
  let accountName: string | null = null;
  const indicators = new Set<string>();
  const parsed: ImportRow[] = [];
  const cell = (row: string[], field: ImportFieldKey) => {
    const index = col(field);
    return index === undefined ? "" : (row[index] ?? "");
  };
  const ident = (
    row: string[],
    id: ImportFieldKey,
    nm: ImportFieldKey,
    what: string,
    line: number,
  ): Identity | null => {
    const rawId = cleanText(cell(row, id), 64);
    const rawName = cleanText(cell(row, nm));
    if (rawId && SCIENTIFIC_ID.test(rawId)) {
      issues.add(
        "error",
        `rounded_${id}`,
        (n) =>
          `${fieldName(id)}s on ${rowsWord(n)} look rounded (for example 1.2E+17), which happens when a spreadsheet opens the file. Upload the export from Ads Manager without opening it first.`,
        { line, value: rawId },
        id,
      );
      return null;
    }
    if (!rawId && !rawName) {
      issues.add(
        "error",
        `missing_value_${id}`,
        (n) =>
          `${rowsWord(n)} ${n === 1 ? "has" : "have"} no ${what} name or ID, so ${n === 1 ? "it" : "they"} can't be matched to ${what === "ad" ? "an ad" : `a ${what}`}.`,
        { line },
        id,
      );
      return null;
    }
    if (rawName && FORMULA_LIKE.test(rawName))
      issues.add(
        "warning",
        "formula_like",
        (n) =>
          `${rowsWord(n)} ${n === 1 ? "has a name" : "have names"} starting with =, +, - or @; ${n === 1 ? "it is" : "they are"} kept as plain text.`,
        { line, value: rawName },
      );
    return { id: rawId || null, name: rawName || null };
  };
  const identityBlank = (row: string[]) =>
    (["campaignId", "campaignName", "adSetId", "adSetName", "adId", "adName"] as const).every(
      (f) => cleanText(cell(row, f)) === "",
    );

  // A Total or "Results from 12 ads" row names no campaign, ad set or ad by ID.
  const totalLike = (row: string[]) =>
    (["campaignId", "adSetId", "adId"] as const).every((f) => cleanText(cell(row, f)) === "") &&
    (["campaignName", "adSetName", "adName"] as const).some((f) =>
      /^(totals?|grand total|results from \d)/i.test(cleanText(cell(row, f))),
    );
  // With a Day column, Day is the row's date and the reporting range only has to
  // contain it (Ads Manager may write the whole report range there). Without
  // one, the reporting range itself must be a single day.
  const dateColumn = inspection.columns[col("date") ?? -1];
  const dayColumn = dateColumn?.role.kind === "field" && dateColumn.role.field === "date";
  const startsIndex = inspection.columns.find((c) => c.key === "reporting starts")?.index;
  const order = dateOrder ?? "ymd";

  const fileLast = { date: "" };
  table.rows.forEach((row, r) => {
    const line = table.lines[r] ?? r + 2;
    if (row.length !== headers.length) {
      issues.add(
        "error",
        "row_width",
        (n) =>
          `${rowsWord(n)} ${n === 1 ? "has" : "have"} more or fewer columns than the header, so the file looks cut short or edited.`,
        { line, value: `${row.length} of ${headers.length} columns` },
      );
      return;
    }
    const dateCell = cell(row, "date");
    // Exports can end with a total row that names no campaign, ad set or ad.
    if (identityBlank(row) || totalLike(row)) {
      issues.add(
        "warning",
        "summary_row",
        (n) =>
          `${rowsWord(n)} that name no campaign, ad set or ad (a total row) ${n === 1 ? "was" : "were"} skipped.`,
        { line },
      );
      return;
    }
    let ok = true;
    const date = parseDate(dateCell, order);
    if (!date) {
      issues.add(
        "error",
        "bad_date",
        (n) => `We couldn't read the date on ${rowsWord(n)}.`,
        { line, value: dateCell },
        "date",
      );
      ok = false;
    }
    if (date && col("reportingEnd") !== undefined) {
      const end = parseDate(cell(row, "reportingEnd"), order);
      const start =
        dayColumn && startsIndex !== undefined
          ? parseDate(row[startsIndex] ?? "", order)
          : null;
      const oneDay = dayColumn
        ? end !== null && date <= end && (start === null || start <= date)
        : end === date;
      if (!oneDay) {
        issues.add(
          "error",
          "multi_day",
          (n) =>
            `${rowsWord(n)} each cover several days. Ad Analyst needs one row per ad per day: in Ads Manager choose Breakdown › By time › Day, then export again.`,
          { line, value: `${dateCell} – ${cell(row, "reportingEnd")}` },
          "date",
        );
        ok = false;
      }
    }
    if (date && date > target.today)
      issues.add(
        "warning",
        "future_date",
        (n) => `${rowsWord(n)} ${n === 1 ? "is" : "are"} dated after today.`,
        { line, value: date },
      );

    const values: Record<MetricField, number> = {
      spend: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      revenue: 0,
    };
    for (const field of METRICS) {
      if (col(field) === undefined || (field === "revenue" && !importRevenue)) continue;
      const raw = cell(row, field);
      const parsedValue = MONEY.has(field)
        ? parseMoney(raw, moneyCurrency, decimal)
        : parseNumber(raw, decimal);
      const label = fieldName(field);
      if (typeof parsedValue === "object" && parsedValue !== null) {
        issues.add(
          "error",
          `symbol_${field}`,
          (n) =>
            `${label} on ${rowsWord(n)} is shown in ${parsedValue.symbol}, but this import is in ${moneyCurrency}.`,
          { line, value: raw },
          field,
        );
        ok = false;
        continue;
      }
      if (parsedValue === "invalid") {
        issues.add(
          "error",
          `invalid_${field}`,
          (n) => `${label} isn't a number on ${rowsWord(n)} (column “${header(field)}”).`,
          { line, value: raw },
          field,
        );
        ok = false;
        continue;
      }
      if (parsedValue === null) {
        issues.add(
          "warning",
          `blank_${field}`,
          (n) =>
            field === "conversions" || field === "revenue"
              ? `“${header(field)}” is blank on ${rowsWord(n)}; read as 0, as Meta leaves results blank when there were none.`
              : `“${header(field)}” is blank on ${rowsWord(n)}; read as 0.`,
          { line },
          field,
        );
        continue;
      }
      if (parsedValue < 0) {
        issues.add(
          "error",
          `negative_${field}`,
          (n) => `${label} is negative on ${rowsWord(n)}.`,
          { line, value: raw },
          field,
        );
        ok = false;
        continue;
      }
      if ((field === "impressions" || field === "clicks") && !Number.isInteger(parsedValue)) {
        issues.add(
          "error",
          `fraction_${field}`,
          (n) => `${label} has decimals on ${rowsWord(n)}; it should be a whole number.`,
          { line, value: raw },
          field,
        );
        ok = false;
        continue;
      }
      values[field] = parsedValue;
    }
    if (values.clicks > values.impressions)
      issues.add(
        "warning",
        "clicks_exceed",
        (n) => `${rowsWord(n)} ${n === 1 ? "has" : "have"} more clicks than impressions.`,
        {
          line,
          value: `${values.clicks} clicks, ${values.impressions} impressions`,
        },
      );

    const campaign = ident(row, "campaignId", "campaignName", "campaign", line);
    const adSet = ident(row, "adSetId", "adSetName", "ad set", line);
    const ad = ident(row, "adId", "adName", "ad", line);
    if (!campaign || !adSet || !ad) ok = false;

    const currencyCell = cleanText(cell(row, "currency"), 8).toUpperCase();
    if (currencyCell) {
      if (!isSupportedCurrency(currencyCell)) {
        issues.add(
          "error",
          "unsupported_currency_row",
          (n) =>
            `${rowsWord(n)} ${n === 1 ? "is" : "are"} in ${currencyCell}. Ad Analyst supports GBP, USD and EUR for now.`,
          { line, value: currencyCell },
          "currency",
        );
        ok = false;
      } else rowCurrencies.add(currencyCell);
    }
    const accountId = cleanText(cell(row, "accountId"), 64);
    if (accountId) accountIds.add(accountId);
    const accName = cleanText(cell(row, "accountName"));
    if (accName && !accountName) accountName = accName;
    if (resultsLike && col("resultIndicator") !== undefined && values.conversions > 0) {
      const indicator = cleanText(cell(row, "resultIndicator"), 120);
      if (indicator) indicators.add(indicator);
    }

    const status = (field: ImportFieldKey) => {
      if (col(field) === undefined) return null;
      const raw = cell(row, field);
      const parsedStatus = parseDelivery(raw);
      if (raw.trim() && !parsedStatus)
        issues.add(
          "warning",
          "unknown_status",
          (n) =>
            `A delivery value on ${rowsWord(n)} wasn't recognised; status there is taken from spend on the last day.`,
          { line, value: cleanText(raw, 40) },
        );
      return parsedStatus;
    };
    const objectiveRaw = cell(row, "objective");
    const objective = col("objective") === undefined ? null : parseObjective(objectiveRaw);
    if (col("objective") !== undefined && objectiveRaw.trim() && !objective)
      issues.add(
        "warning",
        "unknown_objective",
        (n) => `An objective on ${rowsWord(n)} wasn't recognised and is left blank.`,
        { line, value: cleanText(objectiveRaw, 40) },
      );

    if (!ok || !date || !campaign || !adSet || !ad) return;
    if (date > fileLast.date) fileLast.date = date;
    parsed.push({
      line,
      date,
      account: { id: accountId || null, name: accName || null },
      campaign,
      adSet,
      ad,
      creative: {
        id: cleanText(cell(row, "creativeId"), 64) || null,
        name: cleanText(cell(row, "creativeName")) || null,
      },
      creativeFormat:
        col("creativeFormat") === undefined
          ? "unknown"
          : parseCreativeFormat(cell(row, "creativeFormat")),
      campaignStatus: status("campaignStatus"),
      adSetStatus: status("adSetStatus"),
      adStatus: status("adStatus"),
      objective,
      ...values,
    });
  });

  // 4. File-level consistency.
  if (rowCurrencies.size > 1) {
    const [first, second] = [...rowCurrencies];
    issues.add(
      "error",
      "mixed_currency",
      `This file contains more than one currency (${first} and ${second}), so it can't be imported as one account.`,
    );
  }
  const fileCurrency = (
    rowCurrencies.size === 1
      ? [...rowCurrencies][0]
      : headerCurrencies.length === 1
        ? headerCurrencies[0]
        : null
  ) as CurrencyCode | null;
  if (
    rowCurrencies.size === 1 &&
    headerCurrencies.length === 1 &&
    headerCurrencies[0] !== [...rowCurrencies][0]
  )
    issues.add(
      "error",
      "mixed_currency_header",
      `The Currency column says ${[...rowCurrencies][0]} but the column headers say ${headerCurrencies[0]}, so the amounts can't be trusted.`,
    );
  if (fileCurrency && fileCurrency !== target.currency)
    issues.add(
      "error",
      "currency_mismatch",
      `This file is in ${fileCurrency}, but ${target.clientName} uses ${target.currency}.`,
      undefined,
      "currency",
    );
  if (rowCurrencies.size === 0 && headerCurrencies.length === 0)
    issues.add(
      "warning",
      "currency_assumed",
      `The file doesn't say which currency it uses, so amounts are read as ${target.currency}.`,
    );
  if (accountIds.size > 1)
    issues.add(
      "error",
      "multiple_accounts",
      `This file contains ${accountIds.size} ad accounts (${[...accountIds].slice(0, 3).join(", ")}). Import one account at a time.`,
      undefined,
      "accountId",
    );
  const accountId = accountIds.size === 1 ? [...accountIds][0] : null;
  if (accountId && target.existingAccountId && accountId !== target.existingAccountId)
    issues.add(
      "error",
      "account_mismatch",
      `This file is for account ${accountId}, but ${target.clientName} is connected to account ${target.existingAccountId}.`,
      undefined,
      "accountId",
    );
  if (indicators.size > 1)
    issues.add(
      "error",
      "mixed_results",
      `“${header("conversions")}” counts ${indicators.size} different kinds of event, so it can't be one conversion. Choose a column that counts one kind, such as Purchases or Leads.`,
      undefined,
      "conversions",
    );
  else if (resultsLike && col("resultIndicator") === undefined)
    issues.add(
      "warning",
      "results_semantics",
      `“${header("conversions")}” can count different events per campaign; it is counted as ${target.clientName}'s conversions.`,
      undefined,
      "conversions",
    );

  // 5. Duplicates: one ad on one day.
  const breakdowns = inspection.breakdowns.map((c) => c.header);
  const byKey = new Map<string, ImportRow>();
  const exactSeen = new Set<string>();
  for (const row of parsed) {
    const key = `${identityKeys(row).ad}|${row.date}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...row });
      exactSeen.add(JSON.stringify({ ...row, line: 0 }));
      continue;
    }
    if (breakdowns.length) {
      for (const field of METRICS) existing[field] += row[field];
      continue;
    }
    const signature = JSON.stringify({ ...row, line: 0 });
    if (exactSeen.has(signature))
      issues.add(
        "warning",
        "duplicate_rows",
        (n) =>
          `${rowsWord(n)} repeated another row exactly and ${n === 1 ? "was" : "were"} counted once.`,
        { line: row.line },
      );
    else
      issues.add(
        "error",
        "duplicate_conflict",
        (n) =>
          `${rowsWord(n)} repeat an ad and day with different numbers, so we can't tell which is right.`,
        { line: row.line, value: `${row.ad.name ?? row.ad.id} · ${row.date}` },
      );
  }
  if (breakdowns.length)
    issues.add(
      "warning",
      "breakdown_summed",
      `Rows are split by ${breakdowns.join(" and ")}; they are added together per ad and day.`,
    );

  // 6. What the export doesn't say (handled, disclosed).
  const missingIds = (["campaignId", "adSetId", "adId"] as const).filter(
    (f) => col(f) === undefined,
  );
  if (missingIds.length)
    issues.add(
      "warning",
      "ids_missing",
      `${missingIds.map(fieldName).join(", ")} ${missingIds.length === 1 ? "isn't" : "aren't"} in the file, so entities are matched by name; a rename in Meta will appear as a new one.`,
    );
  const statusMissing = (["campaignStatus", "adSetStatus", "adStatus"] as const).filter(
    (f) => col(f) === undefined,
  );
  if (statusMissing.length && fileLast.date)
    issues.add(
      "warning",
      "status_inferred",
      `Delivery status isn't in the file, so anything that spent on ${formatDate(fileLast.date, { year: true })}, the last day, is shown as active and the rest as paused.`,
    );
  if (col("creativeId") === undefined && col("creativeName") === undefined)
    issues.add(
      "warning",
      "creative_per_ad",
      "There's no creative column, so each ad is treated as its own creative, shown without artwork.",
    );
  else if (col("creativeFormat") === undefined)
    issues.add(
      "warning",
      "creative_format",
      "Creative formats aren't in the file, so they show as unknown, without artwork.",
    );

  const rows = [...byKey.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.line - b.line,
  );
  if (rows.length === 0 && !issues.hasErrors())
    issues.add("error", "no_rows", "No rows could be imported from this file.");
  return summarise(issues, rows, fileCurrency, accountId, accountName, table.rows.length);
}

function summarise(
  issues: Issues,
  rows: ImportRow[],
  fileCurrency: CurrencyCode | null,
  accountId: string | null,
  accountName: string | null,
  sourceRows: number,
): ValidationResult {
  const list = issues.list();
  const errors = list.filter((i) => i.level === "error").length;
  return {
    issues: list,
    errors,
    warnings: list.length - errors,
    rows: errors ? [] : rows,
    fileCurrency,
    accountId,
    accountName,
    sourceRows,
  };
}

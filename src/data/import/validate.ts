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

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
const GROUPED_NUMBER = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;

/** Plain or thousands-grouped decimals only; no symbols, percentages or exponents. */
export function parseNumber(cell: string): number | null | "invalid" {
  const v = cell.trim();
  if (v === "" || v === "-" || v === "—") return null;
  if (PLAIN_NUMBER.test(v)) return Number(v);
  if (GROUPED_NUMBER.test(v)) return Number(v.replace(/,/g, ""));
  return "invalid";
}

const SYMBOL_CURRENCY: Record<string, CurrencyCode> = { "£": "GBP", $: "USD", "€": "EUR" };

/**
 * An amount, allowing a leading currency symbol (as a spreadsheet may add).
 * The symbol is only removed when it names the import's currency; a different
 * symbol is reported, never converted.
 */
export function parseMoney(
  cell: string,
  currency: CurrencyCode,
): number | null | "invalid" | { symbol: string } {
  const v = cell.trim();
  const match = /^(-?)([£$€])\s?(.*)$/.exec(v);
  if (!match) return parseNumber(v);
  if (SYMBOL_CURRENCY[match[2]] !== currency) return { symbol: match[2] };
  return parseNumber(`${match[1]}${match[3]}`);
}

/**
 * ISO calendar dates: YYYY-MM-DD (or with slashes), optionally followed by a
 * time, which is ignored. The date is taken exactly as written: no Date
 * parsing of the string and no timezone conversion, so it cannot drift by a
 * day. Day-first and month-first forms are ambiguous and are rejected.
 */
export function parseDate(cell: string): IsoDate | null {
  const match =
    /^(\d{4})[-/](\d{2})[-/](\d{2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(
      cell.trim(),
    );
  if (!match) return null;
  const iso = `${match[1]}-${match[2]}-${match[3]}`;
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
    if (parseDate(value)) dates += 1;
    else {
      const n = parseNumber(value.replace(/^(-?)[£$€]\s?/, "$1").replace(/%$/, ""));
      if (n !== "invalid") numbers += 1;
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

  if (issues.hasErrors()) return summarise(issues, [], null, null, null, table.rows.length);

  // 3. Rows.
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
    // Exports can end with a total row that names no day, campaign, ad set or ad.
    if (!dateCell.trim() && identityBlank(row)) {
      issues.add(
        "warning",
        "summary_row",
        (n) =>
          `${rowsWord(n)} without a date or campaign (a total row) ${n === 1 ? "was" : "were"} skipped.`,
        { line },
      );
      return;
    }
    let ok = true;
    const date = parseDate(dateCell);
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
      const end = parseDate(cell(row, "reportingEnd"));
      if (end !== date) {
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
      const parsedValue = MONEY.has(field) ? parseMoney(raw, moneyCurrency) : parseNumber(raw);
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

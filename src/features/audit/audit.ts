import {
  decodeCsvBytes,
  inspectHeaders,
  isSupportedCurrency,
  normalizeImport,
  outcomeFromIndicator,
  parseCsv,
  parseNumber,
  proposeMapping,
  summarizeRows,
  symbolCurrency,
  validateImport,
  type ColumnMapping,
  type CsvTable,
  type ImportIssue,
  type ImportSummary,
  type Inspection,
  type OutcomeKind,
} from "@/data/import";
import { InMemoryRepository } from "@/data/repository";
import {
  countByPriority,
  runInsightEngine,
  type Finding,
  type PriorityCounts,
} from "@/domain/insights";
import { conversionVocabulary, type ConversionVocabulary } from "@/domain/labels";
import { formatDateRange } from "@/domain/format";
import { percentChange } from "@/domain/metrics";
import { addDays, diffDays, previousRange, type PeriodPair } from "@/domain/periods";
import type {
  ClientType,
  CurrencyCode,
  DateRange,
  EntityStatus,
  IsoDate,
} from "@/domain/types";
import { readTargets } from "@/features/import/targets";
import { collectInsightFacts } from "@/features/insights/facts";

/**
 * The instant audit (D-083): a Meta Ads Manager export read, checked and
 * analysed entirely in the browser by the import pipeline and the
 * deterministic insight rules. Pure: bytes in, a report or one specific
 * problem out. Nothing here stores, sends or logs the file.
 */

/** The audit compares two equal periods of at least this many days. */
export const AUDIT_MIN_PERIOD_DAYS = 7;

/** What stops the audit, written as what to change in Ads Manager. */
export interface AuditProblem {
  code: string;
  title: string;
  detail: string;
  /** The issues found in the file itself, when validation stopped it. */
  issues?: ImportIssue[];
}

export interface OutcomeOption {
  column: number;
  header: string;
  kind: AuditOutcomeKind;
}

export type AuditOutcomeKind = Extract<OutcomeKind, "purchase" | "lead" | "trial">;

export interface AuditCampaignRow {
  id: string;
  name: string;
  status: EntityStatus;
  spend: number;
  spendChange: number | null;
  conversions: number;
  conversionsChange: number | null;
  cpa: number | null;
  roas: number | null;
  /** The campaign's own finding, when it has one. */
  finding: Pick<Finding, "id" | "priority" | "detector"> | null;
}

export interface AuditReport {
  fileName: string;
  accountName: string | null;
  currency: CurrencyCode;
  vocabulary: ConversionVocabulary;
  revenueTracked: boolean;
  /** The column counted as conversions, and the alternatives the file offers. */
  outcome: OutcomeOption;
  outcomeOptions: OutcomeOption[];
  /** Totals over every day in the file. */
  file: ImportSummary & { range: DateRange; span: number; label: string };
  /** The two periods the rules compare: the later half of the file against the earlier half. */
  periods: PeriodPair & { days: number; currentLabel: string; previousLabel: string };
  findings: Finding[];
  counts: PriorityCounts;
  /** Current-period spend, and the part of it on flagged campaigns. */
  spend: {
    period: number;
    needsAttention: number;
    needsAttentionCampaigns: number;
    zeroConversion: number;
    zeroConversionCampaigns: number;
  };
  campaigns: AuditCampaignRow[];
  totals: Omit<AuditCampaignRow, "id" | "name" | "status" | "finding">;
  /** The visitor's optional targets, as the rules received them; null when not set. */
  targets: AuditTargets;
  /** What was resolved automatically while reading the file. */
  notes: string[];
}

export type AuditResult =
  { ok: true; report: AuditReport } | { ok: false; problem: AuditProblem };

const problem = (code: string, title: string, detail: string, issues?: ImportIssue[]) =>
  ({ ok: false, problem: { code, title, detail, issues } }) as const;

const TYPE_FOR: Record<AuditOutcomeKind, ClientType> = {
  purchase: "ecommerce",
  lead: "lead_generation",
  trial: "saas",
};
const OUTCOME_ORDER: readonly AuditOutcomeKind[] = ["purchase", "lead", "trial"];
const isAuditKind = (kind: OutcomeKind | null): kind is AuditOutcomeKind =>
  kind !== null && (OUTCOME_ORDER as readonly string[]).includes(kind);

/** Import notes about artwork, which the audit doesn't show. */
const NOTES_NOT_SHOWN: ReadonlySet<string> = new Set(["creative_per_ad", "creative_format"]);

const COLUMNS_HINT = "Add it from the Columns menu in Ads Manager, then export again.";
const AD_LEVEL_HINT =
  "In Ads Manager, open the Ads tab, so each row is one ad, and export again with Breakdown › By time › Day.";

const hasValues = (table: CsvTable, column: number) =>
  table.rows.some((row) => {
    const n = parseNumber((row[column] ?? "").replace(/[£$€\s]/g, ""));
    return typeof n === "number" && n > 0;
  });

/**
 * The columns that can count conversions, one per kind: Purchases, Leads or
 * Trials started, or Results when its indicator names exactly one of them.
 */
export function outcomeOptions(
  table: CsvTable,
  inspection: Inspection,
): { options: OutcomeOption[]; problem: AuditProblem | null } {
  const options: OutcomeOption[] = [];
  for (const kind of OUTCOME_ORDER) {
    const column = inspection.outcomes.find(
      (c) => c.role.kind === "outcome" && c.role.outcome === kind,
    );
    if (column) options.push({ column: column.index, header: column.header, kind });
  }
  if (options.length > 0) return { options, problem: null };

  const generic = inspection.outcomes.find(
    (c) =>
      c.role.kind === "outcome" &&
      (c.role.outcome === "results" || c.role.outcome === "conversions"),
  );
  const other = inspection.outcomes.find((c) => c.role.kind === "outcome");
  if (!generic) {
    if (other)
      return {
        options,
        problem: {
          code: "unsupported_outcome",
          title: `The audit can't count “${other.header}” yet`,
          detail: `The audit counts purchases, leads or trials. Add the Purchases, Leads or Trials started column. ${COLUMNS_HINT}`,
        },
      };
    return {
      options,
      problem: {
        code: "no_outcome",
        title: "The export has no conversion column",
        detail: `The audit needs a column that counts conversions, such as Purchases or Leads. ${COLUMNS_HINT}`,
      },
    };
  }
  const indicator = inspection.columns.find(
    (c) => c.role.kind === "field" && c.role.field === "resultIndicator",
  );
  if (!indicator)
    return {
      options,
      problem: {
        code: "results_unknown",
        title: `“${generic.header}” doesn't say what it counts`,
        detail: `Results can count different events in each campaign. Add the Purchases or Leads column, or the Result indicator column. ${COLUMNS_HINT}`,
      },
    };
  const kinds = new Set<OutcomeKind | null>();
  const labels = new Set<string>();
  for (const row of table.rows) {
    const count = parseNumber(row[generic.index] ?? "");
    if (typeof count !== "number" || count <= 0) continue;
    const value = (row[indicator.index] ?? "").trim();
    labels.add(value);
    kinds.add(outcomeFromIndicator(value));
  }
  const [kind] = [...kinds];
  if (kinds.size === 1 && isAuditKind(kind))
    return {
      options: [{ column: generic.index, header: generic.header, kind }],
      problem: null,
    };
  if (kinds.size === 0)
    return {
      options,
      problem: {
        code: "no_outcome",
        title: `“${generic.header}” is empty`,
        detail: `No row has a result, so there is nothing to count as conversions. Add the Purchases or Leads column. ${COLUMNS_HINT}`,
      },
    };
  return {
    options,
    problem: {
      code: "mixed_results",
      title: `“${generic.header}” counts ${kinds.size > 1 ? "different events in different campaigns" : "an event the audit doesn't model"}`,
      detail: `${indicator.header} shows ${[...labels].slice(0, 3).join(", ")}. Add the Purchases or Leads column so every campaign is counted the same way. ${COLUMNS_HINT}`,
    },
  };
}

/** Structural problems that need a different export, before any row is read. */
function shapeProblem(inspection: Inspection, mapping: ColumnMapping): AuditProblem | null {
  if (mapping.spend === undefined && !inspection.likelyMeta)
    return {
      code: "not_meta",
      title: "This doesn't look like a Meta Ads Manager export",
      detail:
        "The audit reads the CSV that Ads Manager exports, with columns such as Amount spent, Impressions and Link clicks. Export the table from Ads Manager as CSV and drop that file here.",
    };
  const has = (field: keyof ColumnMapping) => mapping[field] !== undefined;
  if (!has("adId") && !has("adName")) {
    const level = has("adSetId") || has("adSetName") ? "ad set" : "campaign";
    return {
      code: "not_ad_level",
      title: `This export is at ${level} level`,
      detail: `The audit needs one row per ad, so it can check creatives and ads within each campaign. ${AD_LEVEL_HINT}`,
    };
  }
  if (!has("campaignId") && !has("campaignName"))
    return {
      code: "no_campaign",
      title: "The export has no campaign name",
      detail: `Add the Campaign name column. ${COLUMNS_HINT}`,
    };
  if (!has("adSetId") && !has("adSetName"))
    return {
      code: "no_ad_set",
      title: "The export has no ad set name",
      detail: `Add the Ad set name column. ${COLUMNS_HINT}`,
    };
  if (inspection.dateMode === "none")
    return {
      code: "not_daily",
      title: "The export has no date on each row",
      detail:
        "The audit compares days, so it needs one row per ad per day. In Ads Manager choose Breakdown › By time › Day, then export again.",
    };
  for (const [field, label] of [
    ["spend", "Amount spent"],
    ["impressions", "Impressions"],
    ["clicks", "Link clicks"],
  ] as const)
    if (!has(field))
      return {
        code: `no_${field}`,
        title: `The export has no ${label} column`,
        detail: `Add the ${label} column. ${COLUMNS_HINT}`,
      };
  return null;
}

/** The single currency the file states: in headers, a Currency column or amount symbols. */
function fileCurrency(
  table: CsvTable,
  inspection: Inspection,
  mapping: ColumnMapping,
): CurrencyCode | AuditProblem {
  const stated = new Set(inspection.headerCurrencies);
  if (mapping.currency !== undefined)
    for (const row of table.rows) {
      const value = (row[mapping.currency] ?? "").trim().toUpperCase();
      if (value) stated.add(value);
    }
  if (stated.size === 0 && mapping.spend !== undefined) {
    const symbol = symbolCurrency(table.rows.map((row) => row[mapping.spend!] ?? ""));
    if (symbol && symbol !== "mixed") stated.add(symbol);
  }
  const list = [...stated];
  if (list.length > 1)
    return {
      code: "mixed_currency",
      title: "The export mixes currencies",
      detail: `It contains ${list.slice(0, 3).join(" and ")}. Export one ad account at a time.`,
    };
  if (list.length === 0)
    return {
      code: "no_currency",
      title: "The export doesn't say which currency it's in",
      detail:
        "Ads Manager names the currency in its column headers, as in “Amount spent (GBP)”. Upload the file as Ads Manager exported it, without renaming columns.",
    };
  if (!isSupportedCurrency(list[0]))
    return {
      code: "unsupported_currency",
      title: `The audit doesn't read ${list[0]} yet`,
      detail:
        "Ad Analyst reads accounts in GBP, USD and EUR for now. Nothing in Ads Manager changes this.",
    };
  return list[0];
}

export interface AuditTargets {
  targetCpa: number | null;
  targetRoas: number | null;
}

export interface AuditInput {
  bytes: Uint8Array;
  fileName: string;
  /** Today in the visitor's timezone; rows after it are disclosed, not refused. */
  today: IsoDate;
  /** A column chosen among `outcomeOptions`, when the file offers several. */
  outcomeColumn?: number;
  /**
   * Optional targets, validated as Settings validates them (`readTargets`).
   * A ROAS target is dropped when the counted conversions carry no value,
   * as a client without conversion value can't hold one.
   */
  targets?: AuditTargets;
}

/** Reads one export and runs the rules over its later half against its earlier half. */
export function auditExport(input: AuditInput): AuditResult {
  if (/\.xlsx?$/i.test(input.fileName))
    return problem(
      "spreadsheet",
      "This is an Excel file",
      "The audit reads CSV. In Ads Manager, export the table again and choose CSV instead of Excel.",
    );
  const decoded = decodeCsvBytes(input.bytes);
  if (!decoded.ok)
    return problem("unreadable", "We couldn't read this file", decoded.error.message);
  const parsed = parseCsv(decoded.text);
  if (!parsed.ok)
    return problem("unreadable", "We couldn't read this file", parsed.error.message);
  const { table } = parsed;
  const inspection = inspectHeaders(table.headers);
  const base = proposeMapping(inspection, "ecommerce").mapping;
  const shape = shapeProblem(inspection, base);
  if (shape) return { ok: false, problem: shape };

  const outcomes = outcomeOptions(table, inspection);
  if (outcomes.problem) return { ok: false, problem: outcomes.problem };
  const options = outcomes.options;
  // The visitor's choice, else the first kind that has any conversions in the file.
  const outcome =
    options.find((o) => o.column === input.outcomeColumn) ??
    options.find((o) => hasValues(table, o.column)) ??
    options[0];
  const type = TYPE_FOR[outcome.kind];

  const mapping: ColumnMapping = { ...proposeMapping(inspection, type).mapping };
  mapping.conversions = outcome.column;
  const revenueTracked = type === "ecommerce" && mapping.revenue !== undefined;
  if (!revenueTracked) delete mapping.revenue;

  const currency = fileCurrency(table, inspection, mapping);
  if (typeof currency !== "string") return { ok: false, problem: currency };

  const validation = validateImport(
    table,
    mapping,
    {
      clientName: "this account",
      currency,
      businessType: type,
      revenueTracked,
      existingAccountId: null,
      today: input.today,
    },
    inspection,
  );
  if (validation.errors > 0) {
    const issues = validation.issues.filter((i) => i.level === "error");
    return problem(
      "file_issues",
      issues.length === 1
        ? "One thing stops this audit"
        : `${issues.length} things stop this audit`,
      "Nothing was sent anywhere. Fix the export and drop it here again.",
      issues,
    );
  }

  const summary = summarizeRows(validation.rows);
  const first = summary.firstDate!;
  const last = summary.lastDate!;
  const span = diffDays(first, last) + 1;
  const fileRange = { start: first, end: last };
  if (span < AUDIT_MIN_PERIOD_DAYS * 2)
    return problem(
      "too_short",
      `This export covers ${span === 1 ? "one day" : `${span} days`}`,
      `It runs ${formatDateRange(fileRange)}. The audit compares two equal periods of at least ${AUDIT_MIN_PERIOD_DAYS} days, so it needs at least ${AUDIT_MIN_PERIOD_DAYS * 2}. In Ads Manager, set the date range to the last 14 days or longer, keep Breakdown › By time › Day, and export again.`,
    );

  const targets = readTargets(
    {
      targetCpa: input.targets?.targetCpa ?? null,
      targetRoas: revenueTracked ? (input.targets?.targetRoas ?? null) : null,
    },
    revenueTracked,
  );
  if (!targets.ok) return problem("targets", "Check the targets", targets.message);

  const accountName = validation.accountName;
  const client = {
    id: "audit",
    agencyId: "audit",
    name: accountName ?? "This account",
    type,
    currency,
    timezone: "UTC",
    targetCpa: targets.targetCpa,
    targetRoas: targets.targetRoas,
    revenueTracked,
  };
  const normalized = normalizeImport(validation.rows, client, {
    externalId: validation.accountId,
    name: accountName,
  });
  const repository = new InMemoryRepository({
    agency: { id: "audit", name: "Audit" },
    clients: [client],
    ...normalized,
    adAccounts: [normalized.adAccount],
  });

  const days = Math.floor(span / 2);
  const current = { start: addDays(last, -(days - 1)), end: last };
  const periods: PeriodPair = { preset: "custom", current, previous: previousRange(current) };
  const facts = collectInsightFacts(repository, client, periods);
  const findings = runInsightEngine(facts);

  const campaignFinding = new Map(
    findings.filter((f) => f.entity.type === "campaign").map((f) => [f.entity.id, f]),
  );
  const rowFor = (f: (typeof facts.campaigns)[number] | typeof facts.account) => ({
    spend: f.current.totals.spend,
    spendChange: percentChange(f.current.totals.spend, f.previous.totals.spend),
    conversions: f.current.totals.conversions,
    conversionsChange: percentChange(
      f.current.totals.conversions,
      f.previous.totals.conversions,
    ),
    cpa: f.current.derived.cpa,
    roas: revenueTracked ? f.current.derived.roas : null,
  });
  const campaigns: AuditCampaignRow[] = facts.campaigns
    .map((c) => {
      const f = campaignFinding.get(c.entity.id);
      return {
        id: c.entity.id,
        name: c.entity.name,
        status: c.status,
        ...rowFor(c),
        finding: f ? { id: f.id, priority: f.priority, detector: f.detector } : null,
      };
    })
    .sort((a, b) => b.spend - a.spend || a.name.localeCompare(b.name));

  const attention = findings.filter(
    (f) => f.priority === "high" && f.entity.type === "campaign",
  );
  const zero = findings.filter((f) => f.detector === "zero_conversion_spend");
  const sum = (list: Finding[]) => list.reduce((total, f) => total + f.spendInvolved, 0);

  return {
    ok: true,
    report: {
      fileName: input.fileName,
      accountName,
      currency,
      vocabulary: conversionVocabulary(type),
      revenueTracked,
      outcome,
      outcomeOptions: options,
      file: { ...summary, range: fileRange, span, label: formatDateRange(fileRange) },
      periods: {
        ...periods,
        days,
        currentLabel: formatDateRange(periods.current),
        previousLabel: formatDateRange(periods.previous),
      },
      findings,
      counts: countByPriority(findings),
      spend: {
        period: facts.account.current.totals.spend,
        needsAttention: sum(attention),
        needsAttentionCampaigns: attention.length,
        zeroConversion: sum(zero),
        zeroConversionCampaigns: zero.length,
      },
      campaigns,
      totals: rowFor(facts.account),
      targets: { targetCpa: targets.targetCpa, targetRoas: targets.targetRoas },
      notes: validation.issues
        .filter((i) => i.level === "warning" && !NOTES_NOT_SHOWN.has(i.code))
        .map((i) => i.message),
    },
  };
}

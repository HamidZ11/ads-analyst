"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { buttonClasses } from "@/components/ui/button";
import {
  CSV_LIMITS,
  FIELD_BY_KEY,
  SUPPORTED_CURRENCIES,
  decodeCsvBytes,
  isSetupIssue,
  parseCsv,
  proposeMapping,
  summarizeRows,
  validateImport,
  type ColumnMapping,
  type CsvTable,
  type ImportFieldKey,
  type ImportIssue,
  type ValidationResult,
} from "@/data/import";
import { formatCurrency, formatDate, formatNumber } from "@/domain/format";
import { CLIENT_TYPE_LABELS, conversionVocabulary } from "@/domain/labels";
import type { ClientType, CurrencyCode } from "@/domain/types";
import { selectClient } from "@/features/workspace/actions";
import { cn } from "@/lib/cn";
import { IssueList } from "./issue-list";
import { MappingTable } from "./mapping-table";
import type { ImportCompletion } from "./service";
import {
  ADVANCED_FIELDS,
  SETUP_FIELDS,
  columnOptions,
  mappingStatus,
  prepareImport,
  requiredGaps,
  type ImportSetup,
} from "./setup";
import { openImportedClient } from "./completion";

export interface ImportableClient {
  id: string;
  name: string;
  type: ClientType;
  currency: CurrencyCode;
  timezone: string;
  revenueTracked: boolean;
  accountId: string | null;
}

/** Four visible steps over the unchanged pipeline (inspect, map, validate, normalise, import). */
const STEPS = ["Upload", "Review setup", "Review import", "Import"] as const;
type Stage = "upload" | "setup" | "review" | "importing" | "complete";
const STEP_OF: Record<Stage, number> = {
  upload: 0,
  setup: 1,
  review: 2,
  importing: 3,
  complete: 3,
};

const TIMEZONES = [
  "Europe/London",
  "Europe/Dublin",
  "Europe/Paris",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Australia/Sydney",
];

const INPUT =
  "h-8 w-full rounded-md border border-border bg-surface px-2.5 text-sm text-ink transition-colors placeholder:text-ink-faint hover:border-border-strong aria-[invalid=true]:border-negative";

type FieldErrorKey = ImportFieldKey | "name" | "targetCpa" | "targetRoas" | "currency";

function sizeLabel(bytes: number) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const plural = (n: number, one: string, many: string) =>
  `${formatNumber(n)} ${n === 1 ? one : many}`;

function StageHeading({ children, id }: { children: string; id: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <h2
      id={id}
      ref={ref}
      tabIndex={-1}
      className="text-base font-semibold tracking-[-0.01em] text-ink outline-none"
    >
      {children}
    </h2>
  );
}

function Fact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd
        className="mt-0.5 truncate text-[15px] leading-5 font-semibold tracking-[-0.01em] text-ink tabular"
        title={value}
      >
        {value}
      </dd>
      {detail ? <dd className="mt-0.5 truncate text-xs text-ink-muted">{detail}</dd> : null}
    </div>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="mt-1 text-xs leading-4 text-negative">
      {message}
    </p>
  ) : null;
}

interface NewClientDraft {
  name: string;
  type: ClientType;
  currency: CurrencyCode;
  timezone: string;
  targetCpa: string;
  targetRoas: string;
}

/**
 * Meta Ads CSV import as four steps: upload; review setup (what was
 * recognised, plus only the decisions we cannot make); review import (the
 * confidence checkpoint); import. Inspection, mapping and validation run
 * automatically here and again on the server before anything is saved.
 */
export function ImportFlow({
  clients,
  initialDestination,
}: {
  clients: ImportableClient[];
  initialDestination: string;
}) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("upload");
  const [file, setFile] = useState<{ name: string; bytes: number; text: string } | null>(null);
  const [table, setTable] = useState<CsvTable | null>(null);
  const [setup, setSetup] = useState<ImportSetup | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [destination, setDestination] = useState<string>(
    clients.some((c) => c.id === initialDestination) ? initialDestination : "new",
  );
  const [draft, setDraft] = useState<NewClientDraft>({
    name: "",
    type: "ecommerce",
    currency: "GBP",
    timezone: "Europe/London",
    targetCpa: "",
    targetRoas: "",
  });
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [conversionsTouched, setConversionsTouched] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showAllFields, setShowAllFields] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<ImportCompletion | null>(null);
  const pendingFocus = useRef<string | null>(null);

  const existing = clients.find((c) => c.id === destination) ?? null;
  const businessType: ClientType = existing?.type ?? draft.type;
  const fileCurrency = setup?.detected.currency ?? null;
  const currency: CurrencyCode = existing?.currency ?? fileCurrency ?? draft.currency;
  const revenueTracked = existing ? existing.revenueTracked : mapping.revenue !== undefined;
  const vocabulary = conversionVocabulary(businessType);
  const clientName = existing?.name ?? (draft.name.trim() || "the new client");
  const status = mappingStatus(mapping);
  const summary = useMemo(
    () => (validation ? summarizeRows(validation.rows) : null),
    [validation],
  );
  const blockers = validation?.issues.filter((i) => i.level === "error") ?? [];

  // Focus a field once the advanced section has rendered it.
  useEffect(() => {
    if (!pendingFocus.current) return;
    document.getElementById(pendingFocus.current)?.focus();
    pendingFocus.current = null;
  });

  async function readFile(picked: File) {
    setUploadError(null);
    if (!/\.csv$/i.test(picked.name)) {
      setUploadError(
        "Choose a .csv file. Excel workbooks (.xlsx) aren't supported; export the table as CSV.",
      );
      return;
    }
    if (picked.size > CSV_LIMITS.maxBytes) {
      setUploadError(
        `The file is ${sizeLabel(picked.size)}; the limit is 10 MB. Export a shorter date range.`,
      );
      return;
    }
    const decoded = decodeCsvBytes(new Uint8Array(await picked.arrayBuffer()));
    if (!decoded.ok) return setUploadError(decoded.error.message);
    const parsed = parseCsv(decoded.text);
    if (!parsed.ok) return setUploadError(parsed.error.message);
    const prepared = prepareImport(parsed.table, existing?.type);
    if (prepared.inspection.columns.filter((c) => c.role.kind !== "unknown").length < 3)
      return setUploadError(
        "This doesn't look like an ad report: no columns such as Day, Campaign name or Amount spent were found. Check that the first row is the header.",
      );
    setFile({ name: picked.name, bytes: picked.size, text: decoded.text });
    setTable(parsed.table);
    setSetup(prepared);
    setMapping(prepared.mapping);
    setConversionsTouched(false);
    setErrors({});
    setValidation(null);
    setAdvancedOpen(false);
    setDraft((d) => ({
      ...d,
      type: prepared.suggestedType ?? d.type,
      currency: prepared.detected.currency ?? d.currency,
    }));
    setStage("setup");
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const picked = event.dataTransfer.files[0];
    if (picked) void readFile(picked);
  }

  /** A different business type proposes a different conversion, unless one was chosen. */
  function repropose(type: ClientType) {
    if (!setup || conversionsTouched) return;
    const next = proposeMapping(setup.inspection, type).mapping;
    setMapping((m) => {
      const merged = { ...m };
      for (const key of ["conversions", "revenue"] as const) {
        if (next[key] === undefined) delete merged[key];
        else merged[key] = next[key];
      }
      return merged;
    });
  }

  function chooseDestination(id: string) {
    setDestination(id);
    setErrors({});
    repropose(clients.find((c) => c.id === id)?.type ?? draft.type);
  }

  function setField(field: ImportFieldKey, column: number | undefined) {
    if (field === "conversions") setConversionsTouched(true);
    setMapping((m) => {
      const next = { ...m };
      if (column === undefined) delete next[field];
      else next[field] = column;
      return next;
    });
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  const parseTarget = (raw: string) => {
    if (raw.trim() === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : NaN;
  };

  const controlId = (key: FieldErrorKey) =>
    key === "conversions" || key === "revenue"
      ? `setup-${key}`
      : key === "name" || key === "targetCpa" || key === "targetRoas" || key === "currency"
        ? `client-${key}`
        : `map-${key}`;

  function focusFirst(found: Partial<Record<FieldErrorKey, string>>) {
    const first = Object.keys(found)[0] as FieldErrorKey | undefined;
    if (!first) return;
    if (
      !SETUP_FIELDS.has(first as ImportFieldKey) &&
      !first.startsWith("target") &&
      first !== "name" &&
      first !== "currency"
    )
      setAdvancedOpen(true);
    pendingFocus.current = controlId(first);
    document.getElementById(controlId(first))?.focus();
  }

  function reviewImport() {
    if (!table || !setup) return;
    const found: Partial<Record<FieldErrorKey, string>> = {};
    if (!existing) {
      if (!draft.name.trim()) found.name = "Enter a name for the new client.";
      if (Number.isNaN(parseTarget(draft.targetCpa)))
        found.targetCpa = "Enter a positive amount, or leave blank.";
      if (Number.isNaN(parseTarget(draft.targetRoas)))
        found.targetRoas = "Enter a positive multiple, or leave blank.";
    }
    for (const gap of requiredGaps(mapping))
      found[gap] =
        gap === "conversions"
          ? "Choose the column that counts this client's conversions."
          : `Choose the column for ${FIELD_BY_KEY.get(gap)!.label.replace(/ ID$/, "").toLowerCase()}.`;
    if (Object.keys(found).length) {
      setErrors(found);
      focusFirst(found);
      return;
    }
    const result = validateImport(
      table,
      mapping,
      {
        clientName,
        currency,
        businessType,
        revenueTracked,
        existingAccountId: existing?.accountId ?? null,
        today: todayIso(),
      },
      setup.inspection,
    );
    // Column and setting problems are resolved here; file problems are shown on review.
    const setupIssues = result.issues.filter(isSetupIssue);
    if (setupIssues.length) {
      const byField: Partial<Record<FieldErrorKey, string>> = {};
      for (const issue of setupIssues) byField[issue.field ?? "conversions"] ??= issue.message;
      setErrors(byField);
      focusFirst(byField);
      return;
    }
    setErrors({});
    setValidation(result);
    setServerError(null);
    setStage("review");
  }

  async function runImport() {
    if (!file) return;
    setStage("importing");
    setServerError(null);
    try {
      const response = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          fileBytes: file.bytes,
          csv: file.text,
          mapping,
          destination: existing
            ? { kind: "existing", clientId: existing.id }
            : {
                kind: "new",
                client: {
                  name: draft.name.trim(),
                  type: draft.type,
                  currency,
                  timezone: draft.timezone,
                  targetCpa: parseTarget(draft.targetCpa),
                  targetRoas:
                    mapping.revenue !== undefined ? parseTarget(draft.targetRoas) : null,
                },
              },
        }),
      });
      const body = (await response.json()) as
        | { ok: true; result: ImportCompletion }
        | { ok: false; message: string; issues?: ImportIssue[] };
      if (!body.ok) {
        setServerError(body.message);
        if (body.issues && validation)
          setValidation({
            ...validation,
            issues: body.issues,
            errors: body.issues.filter((i) => i.level === "error").length,
            rows: [],
          });
        setStage("review");
        return;
      }
      setCompletion(body.result);
      setStage("complete");
      router.refresh();
    } catch {
      setServerError("The import couldn't reach the server. Nothing was changed; try again.");
      setStage("review");
    }
  }

  function restart() {
    if (completion) setDestination(completion.clientId);
    setFile(null);
    setTable(null);
    setSetup(null);
    setMapping({});
    setValidation(null);
    setCompletion(null);
    setServerError(null);
    setErrors({});
    setStage("upload");
  }

  const optionsFor = (field: ImportFieldKey) =>
    setup ? columnOptions(field, setup.kinds, setup.inspection, mapping[field]) : [];
  const advancedFields = ADVANCED_FIELDS.filter(
    (f) =>
      showAllFields ||
      f.requirement !== "optional" ||
      mapping[f.key] !== undefined ||
      errors[f.key] !== undefined,
  );
  const hiddenCount = ADVANCED_FIELDS.length - advancedFields.length;
  const outcomeHeader =
    table && mapping.conversions !== undefined ? table.headers[mapping.conversions] : null;
  const revenueHeader =
    table && mapping.revenue !== undefined && revenueTracked
      ? table.headers[mapping.revenue]
      : null;
  const detected = setup?.detected;

  return (
    <div className="max-w-[960px]">
      <ol
        aria-label="Import steps"
        className="flex flex-wrap gap-x-5 gap-y-1 border-b border-border pb-3 text-xs"
      >
        {STEPS.map((label, index) => {
          const current = STEP_OF[stage] === index;
          const done = STEP_OF[stage] > index || stage === "complete";
          return (
            <li
              key={label}
              aria-current={current ? "step" : undefined}
              className={cn(
                "flex items-center gap-1.5 tabular",
                current
                  ? "font-medium text-ink"
                  : done
                    ? "text-ink-secondary"
                    : "text-ink-faint",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "flex size-4 items-center justify-center rounded-full text-[10px]",
                  current
                    ? "bg-ink text-surface"
                    : done
                      ? "bg-surface-active text-ink-secondary"
                      : "border border-border",
                )}
              >
                {index + 1}
              </span>
              {label}
              {done && !current ? <span className="sr-only">(done)</span> : null}
            </li>
          );
        })}
      </ol>

      <div className="pt-6">
        {stage === "upload" ? (
          <section aria-labelledby="stage-upload">
            <StageHeading id="stage-upload">Upload a Meta Ads export</StageHeading>
            <p className="mt-1 max-w-[640px] text-sm leading-5 text-ink-muted">
              In Ads Manager, open the Ads tab, add the Day breakdown, then choose Export table
              data as CSV. We&apos;ll recognise the columns for you.
            </p>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={cn(
                "mt-5 flex flex-col items-start gap-3 rounded-lg border border-dashed px-5 py-6 transition-colors sm:flex-row sm:items-center sm:justify-between",
                dragging
                  ? "border-accent bg-accent-soft/40"
                  : "border-border-strong bg-surface-subtle",
              )}
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  Drop a .csv file here, or choose one
                </p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  CSV only · up to 10 MB and 100,000 rows · read on this server, never sent
                  elsewhere
                </p>
              </div>
              <label
                htmlFor="import-file"
                className={buttonClasses(
                  "secondary",
                  "md",
                  "cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent",
                )}
              >
                Choose file
                <input
                  id="import-file"
                  type="file"
                  accept=".csv,text/csv"
                  aria-describedby={uploadError ? "import-file-error" : undefined}
                  className="sr-only"
                  onChange={(e) => {
                    const picked = e.target.files?.[0];
                    if (picked) void readFile(picked);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {uploadError ? (
              <p id="import-file-error" role="alert" className="mt-3 text-sm text-negative">
                {uploadError}
              </p>
            ) : null}
            {file && setup ? (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-sm">
                <span className="text-ink-secondary">
                  {file.name} · {sizeLabel(file.bytes)} ·{" "}
                  {plural(setup.detected.rows, "row", "rows")}
                </span>
                <button
                  type="button"
                  onClick={() => setStage("setup")}
                  className={buttonClasses("primary")}
                >
                  Continue with this file
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {stage === "setup" && table && setup && detected ? (
          <section aria-labelledby="stage-setup">
            <StageHeading id="stage-setup">Review setup</StageHeading>
            <p className="mt-1 max-w-[680px] text-sm leading-5 text-ink-muted">
              {detected.likelyMeta ? "We recognised a Meta Ads export" : "We read the file"} and
              matched its columns.
              {requiredGaps(mapping).length
                ? " We need a little more from you before importing."
                : " Confirm the client below, then review the import."}
            </p>

            <dl
              aria-label="Detected in the file"
              className="mt-5 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-border py-4 sm:grid-cols-4"
            >
              <Fact
                label="File"
                value={file?.name ?? ""}
                detail={file ? sizeLabel(file.bytes) : undefined}
              />
              <Fact
                label="Dates"
                value={
                  detected.firstDate
                    ? `${formatDate(detected.firstDate)} – ${formatDate(detected.lastDate!, { year: true })}`
                    : "Not found"
                }
                detail={detected.days ? plural(detected.days, "day", "days") : undefined}
              />
              <Fact
                label="Rows"
                value={formatNumber(detected.rows)}
                detail={detected.daily ? "Ad-level daily rows" : "No daily breakdown found"}
              />
              <Fact
                label="Campaigns"
                value={formatNumber(detected.campaigns)}
                detail={`${plural(detected.adSets, "ad set", "ad sets")} · ${plural(detected.ads, "ad", "ads")}`}
              />
              <Fact
                label="Currency"
                value={
                  detected.currency ??
                  (detected.currencies.length ? detected.currencies.join(", ") : "Not stated")
                }
                detail={
                  detected.currency
                    ? "From the file"
                    : detected.currencies.length > 1
                      ? "More than one in the file"
                      : detected.currencies.length
                        ? "Not supported"
                        : "Set below"
                }
              />
              <Fact
                label="Conversions"
                value={outcomeHeader ?? "Choose below"}
                detail={
                  detected.outcomeHeaders.length
                    ? `${plural(detected.outcomeHeaders.length, "outcome column", "outcome columns")} found`
                    : "No outcome column recognised"
                }
              />
              <Fact
                label="Conversion value"
                value={revenueHeader ?? "None"}
                detail={revenueHeader ? "ROAS available" : "ROAS not available"}
              />
            </dl>

            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-ink">Client</legend>
              {clients.length ? (
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:gap-6">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="destination"
                      checked={existing !== null}
                      onChange={() => chooseDestination(clients[0].id)}
                      className="accent-accent"
                    />
                    An existing imported client
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="radio"
                      name="destination"
                      checked={existing === null}
                      onChange={() => chooseDestination("new")}
                      className="accent-accent"
                    />
                    A new client
                  </label>
                </div>
              ) : (
                <p className="mt-1 text-xs text-ink-muted">
                  This import creates a new client; demo clients are read-only.
                </p>
              )}

              {existing ? (
                <div className="mt-4 max-w-[420px]">
                  <label
                    htmlFor="client-existing"
                    className="text-xs font-medium text-ink-muted"
                  >
                    Client
                  </label>
                  <select
                    id="client-existing"
                    value={existing.id}
                    onChange={(e) => chooseDestination(e.target.value)}
                    className={cn(INPUT, "mt-1")}
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-ink-muted">
                    {CLIENT_TYPE_LABELS[existing.type]} · {existing.currency} ·{" "}
                    {existing.revenueTracked
                      ? "tracks conversion value"
                      : "no conversion value"}
                    {existing.accountId ? ` · account ${existing.accountId}` : ""}
                  </p>
                </div>
              ) : (
                <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <label htmlFor="client-name" className="text-xs font-medium text-ink-muted">
                      Client name
                    </label>
                    <input
                      id="client-name"
                      type="text"
                      maxLength={80}
                      value={draft.name}
                      aria-invalid={errors.name ? true : undefined}
                      aria-describedby={errors.name ? "client-name-error" : undefined}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, name: e.target.value }));
                        setErrors((x) => ({ ...x, name: undefined }));
                      }}
                      className={cn(INPUT, "mt-1")}
                    />
                    <FieldError id="client-name-error" message={errors.name} />
                  </div>
                  <div>
                    <label htmlFor="client-type" className="text-xs font-medium text-ink-muted">
                      Business type
                    </label>
                    <select
                      id="client-type"
                      value={draft.type}
                      aria-describedby={setup.suggestedType ? "client-type-hint" : undefined}
                      onChange={(e) => {
                        const type = e.target.value as ClientType;
                        setDraft((d) => ({ ...d, type }));
                        repropose(type);
                      }}
                      className={cn(INPUT, "mt-1")}
                    >
                      {(Object.keys(CLIENT_TYPE_LABELS) as ClientType[]).map((t) => (
                        <option key={t} value={t}>
                          {CLIENT_TYPE_LABELS[t]} ·{" "}
                          {conversionVocabulary(t).plural.toLowerCase()}
                        </option>
                      ))}
                    </select>
                    {setup.suggestedType ? (
                      <p id="client-type-hint" className="mt-1 text-xs text-ink-muted">
                        Suggested from the file&apos;s {detected.outcomeHeaders[0]} column.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <label
                      htmlFor="client-timezone"
                      className="text-xs font-medium text-ink-muted"
                    >
                      Reporting timezone
                    </label>
                    <select
                      id="client-timezone"
                      value={draft.timezone}
                      onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))}
                      className={cn(INPUT, "mt-1")}
                    >
                      {TIMEZONES.map((z) => (
                        <option key={z} value={z}>
                          {z.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  {detected.currencies.length ? null : (
                    <div>
                      <label
                        htmlFor="client-currency"
                        className="text-xs font-medium text-ink-muted"
                      >
                        Currency
                      </label>
                      <select
                        id="client-currency"
                        value={draft.currency}
                        aria-describedby="client-currency-hint"
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, currency: e.target.value as CurrencyCode }))
                        }
                        className={cn(INPUT, "mt-1")}
                      >
                        {SUPPORTED_CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <p id="client-currency-hint" className="mt-1 text-xs text-ink-muted">
                        The file doesn&apos;t say; choose the account&apos;s currency.
                      </p>
                    </div>
                  )}
                  <div>
                    <label
                      htmlFor="client-targetCpa"
                      className="text-xs font-medium text-ink-muted"
                    >
                      Target {vocabulary.costLabel.toLowerCase()} ({currency}, optional)
                    </label>
                    <input
                      id="client-targetCpa"
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="any"
                      value={draft.targetCpa}
                      aria-invalid={errors.targetCpa ? true : undefined}
                      aria-describedby={errors.targetCpa ? "client-targetCpa-error" : undefined}
                      onChange={(e) => {
                        setDraft((d) => ({ ...d, targetCpa: e.target.value }));
                        setErrors((x) => ({ ...x, targetCpa: undefined }));
                      }}
                      className={cn(INPUT, "mt-1")}
                    />
                    <FieldError id="client-targetCpa-error" message={errors.targetCpa} />
                  </div>
                  {mapping.revenue !== undefined ? (
                    <div>
                      <label
                        htmlFor="client-targetRoas"
                        className="text-xs font-medium text-ink-muted"
                      >
                        Target ROAS (optional)
                      </label>
                      <input
                        id="client-targetRoas"
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="any"
                        value={draft.targetRoas}
                        aria-invalid={errors.targetRoas ? true : undefined}
                        aria-describedby={
                          errors.targetRoas ? "client-targetRoas-error" : undefined
                        }
                        onChange={(e) => {
                          setDraft((d) => ({ ...d, targetRoas: e.target.value }));
                          setErrors((x) => ({ ...x, targetRoas: undefined }));
                        }}
                        className={cn(INPUT, "mt-1")}
                      />
                      <FieldError id="client-targetRoas-error" message={errors.targetRoas} />
                    </div>
                  ) : null}
                </div>
              )}
            </fieldset>

            <fieldset className="mt-6">
              <legend className="text-sm font-medium text-ink">Conversions</legend>
              <div className="mt-2 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="setup-conversions"
                    className="text-xs font-medium text-ink-muted"
                  >
                    Primary conversion · counted as {vocabulary.plural.toLowerCase()}
                  </label>
                  <select
                    id="setup-conversions"
                    value={mapping.conversions ?? ""}
                    aria-invalid={errors.conversions ? true : undefined}
                    aria-describedby="setup-conversions-note"
                    onChange={(e) =>
                      setField(
                        "conversions",
                        e.target.value === "" ? undefined : Number(e.target.value),
                      )
                    }
                    className={cn(INPUT, "mt-1")}
                  >
                    <option value="">Choose a column</option>
                    {optionsFor("conversions").map((index) => (
                      <option key={index} value={index}>
                        {table.headers[index]}
                      </option>
                    ))}
                  </select>
                  <p
                    id="setup-conversions-note"
                    className={cn(
                      "mt-1 text-xs leading-4",
                      errors.conversions ? "text-negative" : "text-ink-muted",
                    )}
                  >
                    {errors.conversions ??
                      (mapping.conversions === undefined
                        ? setup.outcomeNote
                        : conversionsTouched
                          ? `Counted as ${vocabulary.plural.toLowerCase()}.`
                          : `Found “${outcomeHeader}”; counted as ${vocabulary.plural.toLowerCase()}.`)}
                  </p>
                </div>
                {setup.inspection.revenues.length || existing?.revenueTracked ? (
                  <div>
                    <label
                      htmlFor="setup-revenue"
                      className="text-xs font-medium text-ink-muted"
                    >
                      Conversion value
                    </label>
                    <select
                      id="setup-revenue"
                      value={mapping.revenue ?? ""}
                      aria-invalid={errors.revenue ? true : undefined}
                      aria-describedby="setup-revenue-note"
                      onChange={(e) =>
                        setField(
                          "revenue",
                          e.target.value === "" ? undefined : Number(e.target.value),
                        )
                      }
                      className={cn(INPUT, "mt-1")}
                    >
                      <option value="">None · ROAS won&apos;t be available</option>
                      {optionsFor("revenue").map((index) => (
                        <option key={index} value={index}>
                          {table.headers[index]}
                        </option>
                      ))}
                    </select>
                    <p
                      id="setup-revenue-note"
                      className={cn(
                        "mt-1 text-xs leading-4",
                        errors.revenue ? "text-negative" : "text-ink-muted",
                      )}
                    >
                      {errors.revenue ??
                        (mapping.revenue !== undefined
                          ? "Used for revenue and ROAS."
                          : "Revenue and ROAS won't be shown.")}
                    </p>
                  </div>
                ) : (
                  <p className="self-end pb-1 text-xs text-ink-muted">
                    No conversion value column, so ROAS won&apos;t be available.
                  </p>
                )}
              </div>
            </fieldset>

            <details
              open={advancedOpen}
              onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}
              className="group mt-6 border-t border-border pt-4"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 rounded-sm text-sm [&::-webkit-details-marker]:hidden">
                <span className="font-medium text-ink">
                  <span
                    aria-hidden
                    className="mr-1.5 inline-block text-ink-muted transition-transform group-open:rotate-90"
                  >
                    ›
                  </span>
                  Advanced column mapping
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    status.missing.length ? "text-negative" : "text-ink-muted",
                  )}
                >
                  {status.missing.length ? (
                    <span aria-hidden className="size-1.5 rounded-full bg-negative" />
                  ) : null}
                  {status.label}
                </span>
              </summary>
              <div className="mt-3">
                <MappingTable
                  table={table}
                  fields={advancedFields}
                  mapping={mapping}
                  optionsFor={optionsFor}
                  onChange={setField}
                  invalid={
                    new Set(
                      Object.keys(errors).filter(
                        (k) => errors[k as FieldErrorKey],
                      ) as ImportFieldKey[],
                    )
                  }
                  notes={Object.fromEntries(
                    Object.entries(errors).filter(
                      ([k, v]) => v && !SETUP_FIELDS.has(k as ImportFieldKey),
                    ),
                  )}
                />
                {hiddenCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      // Keep focus on the first field the button revealed.
                      const revealed = ADVANCED_FIELDS.find((f) => !advancedFields.includes(f));
                      if (revealed) pendingFocus.current = `map-${revealed.key}`;
                      setShowAllFields(true);
                    }}
                    className="mt-2 text-xs font-medium text-accent hover:underline"
                  >
                    Show {hiddenCount} more optional {hiddenCount === 1 ? "field" : "fields"}{" "}
                    not found in the file
                  </button>
                ) : null}
              </div>
            </details>

            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStage("upload")}
                className={buttonClasses("secondary")}
              >
                Choose another file
              </button>
              <button type="button" onClick={reviewImport} className={buttonClasses("primary")}>
                Review import
              </button>
            </div>
          </section>
        ) : null}

        {(stage === "review" || stage === "importing") && validation && summary ? (
          <section aria-labelledby="stage-review" aria-busy={stage === "importing"}>
            <StageHeading key={stage} id="stage-review">
              {stage === "importing"
                ? "Importing"
                : blockers.length
                  ? "This file can't be imported yet"
                  : "Review import"}
            </StageHeading>
            <p className="mt-1 text-sm text-ink-muted">
              {existing
                ? `Into ${existing.name}`
                : `Creates ${clientName} · ${CLIENT_TYPE_LABELS[draft.type]} · ${currency}`}
              {validation.accountId ? ` · account ${validation.accountId}` : ""}
            </p>
            {serverError ? (
              <p role="alert" className="mt-3 text-sm text-negative">
                {serverError}
              </p>
            ) : null}

            {blockers.length ? (
              <IssueList
                issues={validation.issues}
                level="error"
                title={`${blockers.length === 1 ? "One thing stops" : `${blockers.length} things stop`} this import`}
              />
            ) : (
              <>
                <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5 border-y border-border py-5 sm:grid-cols-4">
                  <Fact
                    label="Dates"
                    value={`${formatDate(summary.firstDate!)} – ${formatDate(summary.lastDate!, { year: true })}`}
                    detail={plural(summary.days, "day", "days")}
                  />
                  <Fact
                    label="Rows"
                    value={formatNumber(validation.sourceRows)}
                    detail={plural(summary.rows, "ad-day", "ad-days")}
                  />
                  <Fact
                    label="Campaigns"
                    value={formatNumber(summary.campaigns)}
                    detail={`${plural(summary.adSets, "ad set", "ad sets")} · ${plural(summary.ads, "ad", "ads")}`}
                  />
                  <Fact label="Spend" value={formatCurrency(summary.spend, currency)} />
                  <Fact
                    label={vocabulary.plural}
                    value={formatNumber(summary.conversions, {
                      decimals: Number.isInteger(summary.conversions) ? 0 : 1,
                    })}
                  />
                  <Fact
                    label="Conversion value"
                    value={
                      revenueTracked
                        ? formatCurrency(summary.revenue, currency)
                        : "Not imported"
                    }
                  />
                </dl>
                <section aria-labelledby="import-plan" className="mt-6">
                  <h3 id="import-plan" className="text-sm font-medium text-ink">
                    What we&apos;ll do
                  </h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-5 text-ink-secondary marker:text-ink-faint">
                    <li>
                      Import {plural(summary.rows, "daily ad row", "daily ad rows")} from{" "}
                      {formatDate(summary.firstDate!)} to{" "}
                      {formatDate(summary.lastDate!, { year: true })}.
                    </li>
                    <li>
                      {existing ? `Add or update` : `Create ${clientName} with`}{" "}
                      {plural(summary.campaigns, "campaign", "campaigns")},{" "}
                      {plural(summary.adSets, "ad set", "ad sets")} and{" "}
                      {plural(summary.ads, "ad", "ads")}
                      {existing ? ` in ${existing.name}` : ""}.
                    </li>
                    {existing ? (
                      <li>
                        Update any days already imported for these ads and keep every other day.
                      </li>
                    ) : null}
                    <li>
                      Count “{outcomeHeader}” as {vocabulary.plural.toLowerCase()}
                      {revenueHeader ? ` and “${revenueHeader}” as revenue` : ""}.
                    </li>
                    <li>
                      Calculate CTR, CPC, CPM{revenueTracked ? ", " : " and "}
                      {vocabulary.costLabel.toLowerCase()}
                      {revenueTracked ? " and ROAS" : ""} from the imported totals.
                    </li>
                  </ul>
                </section>
              </>
            )}
            {blockers.length ? null : (
              <IssueList
                issues={validation.issues}
                level="warning"
                title="Handled automatically"
              />
            )}
            <p role="status" className="sr-only">
              {stage === "importing" ? "Importing. Checking the file again and saving." : ""}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={stage === "importing"}
                onClick={() => setStage("setup")}
                className={buttonClasses("secondary")}
              >
                Back to setup
              </button>
              {blockers.length ? (
                <button
                  type="button"
                  onClick={() => setStage("upload")}
                  className={buttonClasses("primary")}
                >
                  Choose another file
                </button>
              ) : (
                <button
                  type="button"
                  disabled={stage === "importing"}
                  onClick={() => void runImport()}
                  className={buttonClasses("primary")}
                >
                  {stage === "importing"
                    ? "Importing…"
                    : `Import ${plural(validation.sourceRows, "row", "rows")}`}
                </button>
              )}
            </div>
          </section>
        ) : null}

        {stage === "complete" && completion ? (
          <section aria-labelledby="stage-complete">
            <StageHeading id="stage-complete">Imported successfully</StageHeading>
            <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-5 border-y border-border py-5 sm:grid-cols-5">
              <Fact label="Client" value={completion.clientName} />
              <Fact
                label="Dates"
                value={`${formatDate(completion.firstDate)} – ${formatDate(completion.lastDate, { year: true })}`}
              />
              <Fact label="Campaigns" value={formatNumber(completion.campaigns)} />
              <Fact label="Ads" value={formatNumber(completion.ads)} />
              <Fact
                label="Spend"
                value={formatCurrency(completion.spend, completion.currency)}
              />
            </dl>
            <p className="mt-3 text-xs text-ink-muted">
              {plural(completion.daysAdded, "new ad-day", "new ad-days")} ·{" "}
              {plural(completion.daysReplaced, "updated ad-day", "updated ad-days")}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  openImportedClient(completion.clientId, selectClient, (href) =>
                    router.push(href),
                  )
                }
                className={buttonClasses("primary")}
              >
                View Overview
              </button>
              <button type="button" onClick={restart} className={buttonClasses("secondary")}>
                Import another file
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

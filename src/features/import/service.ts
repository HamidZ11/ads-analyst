import {
  CSV_LIMITS,
  buildImportPayload,
  cleanText,
  inspectHeaders,
  isSupportedCurrency,
  parseCsv,
  sanitizeMapping,
  summarizeRows,
  validateImport,
  type ImportIssue,
  type ImportPayload,
} from "@/data/import";
import { GatewayError, type ImportWriteResult } from "@/data/supabase/gateway";
import { tracksRevenue } from "@/domain/labels";
import { todayInTimezone } from "@/domain/periods";
import type { Client, ClientType, CurrencyCode, IsoDate } from "@/domain/types";

/**
 * The only write path for imported data. It trusts nothing from the browser:
 * the CSV is parsed again, the mapping is rebuilt from known fields, the
 * destination must be one of the caller's own clients, and validation runs in
 * full before a single atomic write. Demo data is never a destination.
 */

export interface NewClientInput {
  name: string;
  currency: CurrencyCode;
  type: ClientType;
  timezone: string;
  targetCpa: number | null;
  targetRoas: number | null;
}

export interface ImportRequest {
  fileName: string;
  fileBytes: number;
  csv: string;
  mapping: unknown;
  destination: { kind: "existing"; clientId: string } | { kind: "new"; client: NewClientInput };
}

export interface ImportCompletion {
  clientId: string;
  clientName: string;
  currency: CurrencyCode;
  firstDate: IsoDate;
  lastDate: IsoDate;
  campaigns: number;
  ads: number;
  spend: number;
  conversions: number;
  daysAdded: number;
  daysReplaced: number;
  warnings: number;
}

export type ImportResponse =
  | { ok: true; result: ImportCompletion }
  | { ok: false; status: number; message: string; issues?: ImportIssue[] };

const CLIENT_TYPES: readonly ClientType[] = ["ecommerce", "lead_generation", "saas"];
export const MAX_TARGET_CPA = 1_000_000;
export const MAX_TARGET_ROAS = 1_000;

export function isValidTimezone(zone: string): boolean {
  if (!zone || zone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const positiveOrNull = (value: unknown, max: number): number | null | "invalid" => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > max)
    return "invalid";
  return value;
};

/** Validates the shape of a request body; returns a message for anything malformed. */
export function readImportRequest(body: unknown): ImportRequest | string {
  if (typeof body !== "object" || body === null || Array.isArray(body))
    return "Invalid import payload.";
  const b = body as Record<string, unknown>;
  if (
    typeof b.csv !== "string" ||
    typeof b.fileName !== "string" ||
    typeof b.fileBytes !== "number"
  )
    return "Invalid import payload.";
  const destination = b.destination as Record<string, unknown> | undefined;
  if (!destination || typeof destination !== "object")
    return "Choose a client for this import.";
  if (destination.kind === "existing") {
    if (typeof destination.clientId !== "string" || destination.clientId.length > 80)
      return "Choose a client for this import.";
    return {
      fileName: cleanText(b.fileName, 200),
      fileBytes: b.fileBytes,
      csv: b.csv,
      mapping: b.mapping,
      destination: { kind: "existing", clientId: destination.clientId },
    };
  }
  if (destination.kind !== "new") return "Choose a client for this import.";
  const c = destination.client as Record<string, unknown> | undefined;
  if (!c || typeof c !== "object") return "Enter the new client's details.";
  const name = typeof c.name === "string" ? cleanText(c.name, 80) : "";
  if (!name) return "Enter a client name.";
  if (typeof c.currency !== "string" || !isSupportedCurrency(c.currency))
    return "Choose GBP, USD or EUR.";
  if (typeof c.type !== "string" || !CLIENT_TYPES.includes(c.type as ClientType))
    return "Choose the client's business type.";
  if (typeof c.timezone !== "string" || !isValidTimezone(c.timezone))
    return "Choose a valid timezone.";
  const targetCpa = positiveOrNull(c.targetCpa, MAX_TARGET_CPA);
  const targetRoas = positiveOrNull(c.targetRoas, MAX_TARGET_ROAS);
  if (targetCpa === "invalid") return "Target CPA must be a positive amount.";
  if (targetRoas === "invalid") return "Target ROAS must be a positive multiple.";
  return {
    fileName: cleanText(b.fileName, 200),
    fileBytes: b.fileBytes,
    csv: b.csv,
    mapping: b.mapping,
    destination: {
      kind: "new",
      client: {
        name,
        currency: c.currency,
        type: c.type as ClientType,
        timezone: c.timezone,
        targetCpa,
        targetRoas,
      },
    },
  };
}

export interface ImportContext {
  now: Date;
  /** Clients in the caller's active workspace: the only possible destinations. */
  clients: readonly Client[];
  /** The platform account already connected to a client, if any. */
  accountIdFor: (clientId: string) => string | null;
}

export type ImportPlan =
  | { ok: false; status: number; message: string; issues?: ImportIssue[] }
  | {
      ok: true;
      payload: ImportPayload;
      clientName: string;
      currency: CurrencyCode;
      summary: ReturnType<typeof summarizeRows>;
      warnings: number;
    };

const UNAVAILABLE_CLIENT = "That client isn't available. Choose another client.";

/** Parse, validate and normalise: everything short of writing. Pure. */
export function planImport(request: ImportRequest, context: ImportContext): ImportPlan {
  const parsed = parseCsv(request.csv, CSV_LIMITS);
  if (!parsed.ok) return { ok: false, status: 422, message: parsed.error.message };
  const { table } = parsed;
  const inspection = inspectHeaders(table.headers);
  const mapping = sanitizeMapping(request.mapping, table.headers.length);

  let client: Client;
  let destination: ImportPayload["client"];
  if (request.destination.kind === "existing") {
    const id = request.destination.clientId;
    // Same answer whether the client is in another workspace or doesn't exist.
    const found = context.clients.find((c) => c.id === id);
    if (!found) return { ok: false, status: 404, message: UNAVAILABLE_CLIENT };
    client = found;
    destination = { mode: "existing", id: found.id };
  } else {
    const input = request.destination.client;
    if (context.clients.some((c) => c.name.toLowerCase() === input.name.toLowerCase()))
      return {
        ok: false,
        status: 409,
        message: `A client called ${input.name} already exists.`,
      };
    const revenueMapped = mapping.revenue !== undefined;
    if (input.targetRoas !== null && !revenueMapped)
      return {
        ok: false,
        status: 422,
        message: "A ROAS target needs a conversion value column. Map one or clear the target.",
      };
    client = {
      id: "new",
      agencyId: "new",
      name: input.name,
      type: input.type,
      currency: input.currency,
      timezone: input.timezone,
      targetCpa: input.targetCpa,
      targetRoas: input.targetRoas,
      revenueTracked: revenueMapped,
    };
    destination = {
      mode: "new",
      name: input.name,
      type: input.type,
      currency: input.currency,
      timezone: input.timezone,
      target_cpa: input.targetCpa,
      target_roas: input.targetRoas,
      revenue_tracked: revenueMapped,
    };
  }

  const validation = validateImport(
    table,
    mapping,
    {
      clientName: client.name,
      currency: client.currency,
      businessType: client.type,
      revenueTracked: tracksRevenue(client),
      existingAccountId:
        destination.mode === "existing" ? context.accountIdFor(client.id) : null,
      today: todayInTimezone(client.timezone, context.now),
    },
    inspection,
  );
  if (validation.errors > 0)
    return {
      ok: false,
      status: 422,
      message:
        validation.errors === 1
          ? "One thing stops this import."
          : `${validation.errors} things stop this import.`,
      issues: validation.issues,
    };

  const summary = summarizeRows(validation.rows);
  const payload = buildImportPayload({
    rows: validation.rows,
    client,
    destination,
    account: { externalId: validation.accountId, name: validation.accountName },
    record: {
      file_name: request.fileName || "export.csv",
      file_bytes: Math.max(0, Math.round(request.fileBytes)),
      row_count: validation.sourceRows,
      date_start: summary.firstDate!,
      date_end: summary.lastDate!,
      currency: client.currency,
      outcome_column: table.headers[mapping.conversions!] ?? "",
      revenue_column:
        tracksRevenue(client) && mapping.revenue !== undefined
          ? table.headers[mapping.revenue]
          : null,
    },
  });
  return {
    ok: true,
    payload,
    clientName: client.name,
    currency: client.currency,
    summary,
    warnings: validation.warnings,
  };
}

/** Maps a database failure to a safe message; nothing about other workspaces is revealed. */
export function importFailure(
  error: unknown,
  clientName: string,
): { status: number; message: string } {
  const kind = error instanceof GatewayError ? error.kind : "unavailable";
  switch (kind) {
    case "duplicate_name":
      return { status: 409, message: `A client called ${clientName} already exists.` };
    case "not_found":
    case "forbidden":
      return { status: 404, message: UNAVAILABLE_CLIENT };
    case "account_mismatch":
      return {
        status: 422,
        message: `This file is for a different ad account than ${clientName}.`,
      };
    case "invalid":
      return { status: 422, message: "Some values were rejected, so nothing was imported." };
    default:
      return {
        status: 503,
        message: "The database couldn't be reached. Nothing was imported; try again.",
      };
  }
}

/** Plans the import, then writes it in one transaction through `write`. */
export async function runImport(
  request: ImportRequest,
  context: ImportContext,
  write: (payload: ImportPayload) => Promise<ImportWriteResult>,
): Promise<ImportResponse> {
  const plan = planImport(request, context);
  if (!plan.ok) return plan;
  let written: ImportWriteResult;
  try {
    written = await write(plan.payload);
  } catch (error) {
    return { ok: false, ...importFailure(error, plan.clientName) };
  }
  return {
    ok: true,
    result: {
      clientId: written.clientId,
      clientName: plan.clientName,
      currency: plan.currency,
      firstDate: plan.summary.firstDate!,
      lastDate: plan.summary.lastDate!,
      campaigns: plan.summary.campaigns,
      ads: plan.summary.ads,
      spend: plan.summary.spend,
      conversions: plan.summary.conversions,
      daysAdded: written.daysAdded,
      daysReplaced: written.daysReplaced,
      warnings: plan.warnings,
    },
  };
}

/** Optional targets from a form: positive numbers or blank; ROAS needs conversion value. */
export function readTargets(
  input: { targetCpa: unknown; targetRoas: unknown },
  revenueTracked: boolean,
):
  | { ok: true; targetCpa: number | null; targetRoas: number | null }
  | { ok: false; message: string } {
  const targetCpa = positiveOrNull(input.targetCpa, MAX_TARGET_CPA);
  const targetRoas = positiveOrNull(input.targetRoas, MAX_TARGET_ROAS);
  if (targetCpa === "invalid")
    return { ok: false, message: "Target CPA must be a positive amount." };
  if (targetRoas === "invalid")
    return { ok: false, message: "Target ROAS must be a positive multiple." };
  if (targetRoas !== null && !revenueTracked)
    return {
      ok: false,
      message:
        "A ROAS target needs conversion value, which this client's imports do not include.",
    };
  return { ok: true, targetCpa, targetRoas };
}

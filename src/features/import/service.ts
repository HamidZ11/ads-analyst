import { randomUUID } from "node:crypto";
import {
  CSV_LIMITS,
  cleanText,
  inspectHeaders,
  isSupportedCurrency,
  mergeClientData,
  normalizeImport,
  parseCsv,
  sanitizeMapping,
  stableHash,
  summarizeRows,
  validateImport,
  type ImportIssue,
} from "@/data/import";
import { type ImportStore, StoreReadError } from "@/data/store";
import { tracksRevenue } from "@/domain/labels";
import { todayInTimezone } from "@/domain/periods";
import type { Client, ClientType, CurrencyCode, IsoDate } from "@/domain/types";

/**
 * The only write path for imported data. It trusts nothing from the browser:
 * the CSV is parsed again, the mapping is rebuilt from known fields, the
 * destination is checked, and validation runs in full before anything is
 * stored. Seeded demo clients can never be written to.
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

export function runImport(
  request: ImportRequest,
  store: ImportStore,
  context: { now: Date; seededClients: readonly Client[] },
): ImportResponse {
  let state;
  try {
    state = store.read();
  } catch (error) {
    if (error instanceof StoreReadError)
      return {
        ok: false,
        status: 500,
        message: `${error.message} Nothing was imported, so existing data is untouched.`,
      };
    throw error;
  }

  const parsed = parseCsv(request.csv, CSV_LIMITS);
  if (!parsed.ok) return { ok: false, status: 422, message: parsed.error.message };
  const { table } = parsed;
  const inspection = inspectHeaders(table.headers);
  const mapping = sanitizeMapping(request.mapping, table.headers.length);

  // Resolve the destination client.
  let client: Client;
  let existing = null as (typeof state.clients)[number] | null;
  if (request.destination.kind === "existing") {
    const id = request.destination.clientId;
    if (context.seededClients.some((c) => c.id === id))
      return {
        ok: false,
        status: 403,
        message: "Demo clients are read-only. Create a new client for imported data.",
      };
    existing = state.clients.find((b) => b.client.id === id) ?? null;
    if (!existing)
      return {
        ok: false,
        status: 404,
        message: "That client no longer exists. Choose another client.",
      };
    client = existing.client;
  } else {
    const input = request.destination.client;
    const taken = [...context.seededClients, ...state.clients.map((b) => b.client)].some(
      (c) => c.name.toLowerCase() === input.name.toLowerCase(),
    );
    if (taken)
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
      id: `cli_${stableHash(`${input.name}|${context.now.toISOString()}|${randomUUID()}`).slice(0, 12)}`,
      agencyId: context.seededClients[0]?.agencyId ?? "agy_northstar",
      name: input.name,
      type: input.type,
      currency: input.currency,
      timezone: input.timezone,
      targetCpa: input.targetCpa,
      targetRoas: input.targetRoas,
      revenueTracked: revenueMapped,
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
      existingAccountId: existing?.adAccount.externalId || null,
      today: todayInTimezone(client.timezone, context.now),
    },
    inspection,
  );
  if (validation.errors > 0)
    return {
      ok: false,
      status: 422,
      message: `The file has ${validation.errors} ${validation.errors === 1 ? "problem" : "problems"} to fix before it can be imported.`,
      issues: validation.issues,
    };

  const summary = summarizeRows(validation.rows);
  const normalized = normalizeImport(validation.rows, client, {
    externalId: validation.accountId,
    name: validation.accountName,
  });
  const { bundle, daysAdded, daysReplaced } = mergeClientData(existing, client, normalized, {
    id: `imp_${stableHash(`${client.id}|${context.now.toISOString()}|${request.fileName}`).slice(0, 12)}`,
    source: "meta_csv",
    importedAt: context.now.toISOString(),
    fileName: request.fileName || "export.csv",
    fileBytes: Math.max(0, Math.round(request.fileBytes)),
    rows: validation.sourceRows,
    firstDate: summary.firstDate!,
    lastDate: summary.lastDate!,
    accountExternalId: validation.accountId,
    currency: client.currency,
    outcomeColumn: table.headers[mapping.conversions!] ?? "",
    revenueColumn:
      tracksRevenue(client) && mapping.revenue !== undefined
        ? table.headers[mapping.revenue]
        : null,
  });
  store.write({
    version: 1,
    clients: existing
      ? state.clients.map((b) => (b.client.id === client.id ? bundle : b))
      : [...state.clients, bundle],
  });
  return {
    ok: true,
    result: {
      clientId: client.id,
      clientName: client.name,
      currency: client.currency,
      firstDate: summary.firstDate!,
      lastDate: summary.lastDate!,
      campaigns: summary.campaigns,
      ads: summary.ads,
      spend: summary.spend,
      conversions: summary.conversions,
      daysAdded,
      daysReplaced,
      warnings: validation.warnings,
    },
  };
}

/** Updates an imported client's optional targets; demo clients stay read-only. */
export function updateTargets(
  store: ImportStore,
  clientId: string,
  targets: { targetCpa: unknown; targetRoas: unknown },
): { ok: true } | { ok: false; message: string } {
  const state = store.read();
  const bundle = state.clients.find((b) => b.client.id === clientId);
  if (!bundle)
    return { ok: false, message: "Targets can only be edited for imported clients." };
  const targetCpa = positiveOrNull(targets.targetCpa, MAX_TARGET_CPA);
  const targetRoas = positiveOrNull(targets.targetRoas, MAX_TARGET_ROAS);
  if (targetCpa === "invalid")
    return { ok: false, message: "Target CPA must be a positive amount." };
  if (targetRoas === "invalid")
    return { ok: false, message: "Target ROAS must be a positive multiple." };
  if (targetRoas !== null && !tracksRevenue(bundle.client))
    return {
      ok: false,
      message:
        "A ROAS target needs conversion value, which this client's imports do not include.",
    };
  store.write({
    version: 1,
    clients: state.clients.map((b) =>
      b.client.id === clientId ? { ...b, client: { ...b.client, targetCpa, targetRoas } } : b,
    ),
  });
  return { ok: true };
}

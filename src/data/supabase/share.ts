import { createClient } from "@supabase/supabase-js";
import type { DatePreset } from "@/domain/periods";
import { gatewayError } from "./gateway";
import {
  snapshotRepository,
  type SnapshotRepository,
  type WorkspaceSnapshot,
} from "./snapshot";

/**
 * Read-only share links for a client report (D-NEW-share-1). The raw token
 * exists only in the link the owner copies; Postgres stores its SHA-256 and
 * public.shared_client_report is the only way to read through one.
 */

/** The presets a link can pin; "custom" ranges are not built. */
export type SharePreset = Exclude<DatePreset, "custom">;

/** One link as members see it through RLS: never the token or its hash. */
export interface ShareLink {
  id: string;
  clientId: string;
  preset: SharePreset;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  expiresAt: string;
}

export interface NewShareLink {
  clientId: string;
  /** The raw token (32 random bytes, base64url); hashed by the database. */
  token: string;
  preset: SharePreset;
  periodStart: string;
  periodEnd: string;
  days: number;
}

/** What public.shared_client_report returns for a live link. */
export interface SharedReportPayload {
  status: "ok";
  expires_at: string;
  preset: SharePreset;
  period_start: string;
  period_end: string;
  workspace: { id: string; name: string };
  client: WorkspaceSnapshot["clients"][number];
  accounts: WorkspaceSnapshot["accounts"];
  campaigns: WorkspaceSnapshot["campaigns"];
  ad_sets: WorkspaceSnapshot["ad_sets"];
  creatives: WorkspaceSnapshot["creatives"];
  ads: WorkspaceSnapshot["ads"];
  metrics: WorkspaceSnapshot["metrics"];
  note: string | null;
}

export type SharedReportLookup =
  | SharedReportPayload
  | { status: "not_found" }
  | { status: "expired" }
  | { status: "rate_limited" };

/** The share page's only database access: anonymous, one function. */
export interface SharedReportReader {
  lookup(token: string, visitor: string): Promise<SharedReportLookup>;
}

export const SHARE_LINK_COLUMNS =
  "id, client_id, preset, period_start, period_end, created_at, expires_at";

export interface ShareLinkRow {
  id: string;
  client_id: string;
  preset: string;
  period_start: string;
  period_end: string;
  created_at: string;
  expires_at: string;
}

export function shareLinkFromRow(row: ShareLinkRow): ShareLink {
  return {
    id: row.id,
    clientId: row.client_id,
    preset: row.preset as SharePreset,
    periodStart: String(row.period_start).slice(0, 10),
    periodEnd: String(row.period_end).slice(0, 10),
    createdAt: new Date(row.created_at).toISOString(),
    expiresAt: new Date(row.expires_at).toISOString(),
  };
}

export function sharedReportLookup(value: unknown): SharedReportLookup {
  const status = (value as { status?: unknown } | null)?.status;
  if (status === "ok") return value as SharedReportPayload;
  if (status === "expired" || status === "rate_limited") return { status };
  return { status: "not_found" };
}

/**
 * The shared report's rows as a repository, through the same mapping as the
 * workspace snapshot, so the report is built exactly as in the app. It holds
 * one client, and only the rows of the two periods the report compares.
 */
export function sharedReportRepository(payload: SharedReportPayload): SnapshotRepository {
  const dates = payload.metrics.map((m) => String(m.date).slice(0, 10)).sort();
  return snapshotRepository({
    workspace: payload.workspace,
    client_id: payload.client.id,
    clients: [payload.client],
    accounts: payload.accounts,
    imports: [],
    coverage: dates.length
      ? [
          {
            client_id: payload.client.id,
            first_date: dates[0],
            last_date: dates[dates.length - 1],
            days: new Set(dates).size,
            rows: dates.length,
          },
        ]
      : [],
    campaigns: payload.campaigns,
    ad_sets: payload.ad_sets,
    creatives: payload.creatives,
    ads: payload.ads,
    metrics: payload.metrics.map((m) => ({ ...m, date: String(m.date).slice(0, 10) })),
  });
}

/** The publishable key with no session (the `anon` role). Server-only. */
export function supabaseSharedReportReader(
  url: string,
  publishableKey: string,
): SharedReportReader {
  const db = createClient(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    lookup: async (token, visitor) => {
      const { data, error } = await db.rpc("shared_client_report", {
        p_token: token,
        p_visitor: visitor,
      });
      if (error) throw gatewayError(error);
      return sharedReportLookup(data);
    },
  };
}

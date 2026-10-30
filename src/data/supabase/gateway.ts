import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportPayload } from "../import/payload";
import {
  SUBSCRIPTION_COLUMNS,
  subscriptionFromRow,
  type SubscriptionRow,
  type WorkspaceSubscription,
} from "./billing";
import {
  SHARE_LINK_COLUMNS,
  shareLinkFromRow,
  type NewShareLink,
  type ShareLink,
  type ShareLinkRow,
} from "./share";
import type { WorkspaceSnapshot } from "./snapshot";

/**
 * The only path between the application and Postgres. Every call runs as the
 * signed-in user (publishable key + the user's session), so RLS applies; there
 * is no service-role key anywhere in the app. (The Stripe webhook, which has
 * no session, has its own narrower writer in `./billing`.)
 */
export interface WorkspaceMembership {
  id: string;
  name: string;
  role: "owner" | "member";
  joined_at: string;
}

export interface ImportWriteResult {
  clientId: string;
  importId: string;
  daysAdded: number;
  daysReplaced: number;
}

/** The agency's own words for one client and reporting period. */
export interface ReportNote {
  body: string;
  updatedAt: string;
}

export interface WorkspaceGateway {
  /** Creates a personal workspace on first sign-in; returns every membership. */
  ensureWorkspaces(defaultName: string): Promise<WorkspaceMembership[]>;
  snapshot(workspaceId: string, clientId: string | null): Promise<WorkspaceSnapshot>;
  importMetaCsv(workspaceId: string, payload: ImportPayload): Promise<ImportWriteResult>;
  updateTargets(
    clientId: string,
    targetCpa: number | null,
    targetRoas: number | null,
  ): Promise<boolean>;
  /** Owners only; false when the workspace isn't the caller's to rename. */
  renameWorkspace(workspaceId: string, name: string): Promise<boolean>;
  /** Null when there is no note, or the client is not in the caller's workspace. */
  reportNote(
    clientId: string,
    periodStart: string,
    periodEnd: string,
  ): Promise<ReportNote | null>;
  /** A blank body clears the note; false when the client isn't available to the caller. */
  saveReportNote(
    clientId: string,
    periodStart: string,
    periodEnd: string,
    body: string,
  ): Promise<boolean>;
  /** Counts one attempt by the signed-in user; false once their allowance for the window is spent. */
  consumeRateLimit(action: RateLimitedAction): Promise<boolean>;
  /** The workspace's subscription, read through RLS; null when it has never subscribed. */
  subscription(workspaceId: string): Promise<WorkspaceSubscription | null>;
  /** Owners only; null when the client isn't in a workspace the caller owns. */
  createShareLink(link: NewShareLink): Promise<{ id: string; expiresAt: string } | null>;
  /** The workspace's links that still open (not revoked, not expired), newest first. */
  shareLinks(workspaceId: string): Promise<ShareLink[]>;
  /** Any member; false when the link isn't in the caller's workspace. */
  revokeShareLink(linkId: string): Promise<boolean>;
}

/** Operations with a per-user allowance, set in public.consume_rate_limit. */
export type RateLimitedAction = "import";

export type GatewayErrorKind =
  | "forbidden"
  | "not_found"
  | "account_mismatch"
  | "duplicate_name"
  | "invalid"
  | "rate_limited"
  | "unavailable";

/** A database failure with a safe, user-facing classification; raw errors are never shown. */
export class GatewayError extends Error {
  constructor(
    readonly kind: GatewayErrorKind,
    readonly detail: string,
  ) {
    super(detail);
    this.name = "GatewayError";
  }
}

export function gatewayError(error: unknown): GatewayError {
  if (error instanceof GatewayError) return error;
  const e = (error ?? {}) as {
    code?: string;
    message?: string;
    details?: string;
    constraint?: string;
  };
  const code = e.code ?? "";
  const text = `${e.message ?? ""} ${e.details ?? ""} ${e.constraint ?? ""}`;
  if (code === "42501") return new GatewayError("forbidden", text);
  if (code === "P0002") return new GatewayError("not_found", text);
  if (code === "P0003") return new GatewayError("account_mismatch", text);
  if (code === "P0005") return new GatewayError("rate_limited", text);
  if (code === "23505" && /clients_workspace_name_key/.test(text))
    return new GatewayError("duplicate_name", text);
  if (/^(22|23|P0004)/.test(code)) return new GatewayError("invalid", text);
  return new GatewayError("unavailable", text || "database unavailable");
}

const asResult = (value: unknown): ImportWriteResult => {
  const r = value as {
    client_id: string;
    import_id: string;
    days_added: number;
    days_replaced: number;
  };
  return {
    clientId: r.client_id,
    importId: r.import_id,
    daysAdded: Number(r.days_added),
    daysReplaced: Number(r.days_replaced),
  };
};

const asCreatedLink = (value: unknown) => {
  const r = value as { id?: unknown; expires_at?: unknown } | null;
  return r && typeof r.id === "string"
    ? { id: r.id, expiresAt: new Date(String(r.expires_at)).toISOString() }
    : null;
};

const asNote = (value: unknown): ReportNote | null => {
  const r = value as { body?: unknown; updated_at?: unknown } | null;
  return r && typeof r.body === "string"
    ? { body: r.body, updatedAt: String(r.updated_at) }
    : null;
};

export function supabaseGateway(db: SupabaseClient): WorkspaceGateway {
  const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw gatewayError(error);
    return data as T;
  };
  return {
    ensureWorkspaces: (defaultName) =>
      call<WorkspaceMembership[]>("ensure_default_workspace", { p_name: defaultName }),
    snapshot: (workspaceId, clientId) =>
      call<WorkspaceSnapshot>("workspace_snapshot", {
        p_workspace_id: workspaceId,
        p_client_id: clientId,
      }),
    importMetaCsv: async (workspaceId, payload) =>
      asResult(
        await call<unknown>("import_meta_csv", {
          p_workspace_id: workspaceId,
          p_payload: payload,
        }),
      ),
    updateTargets: (clientId, targetCpa, targetRoas) =>
      call<boolean>("update_client_targets", {
        p_client_id: clientId,
        p_target_cpa: targetCpa,
        p_target_roas: targetRoas,
      }),
    renameWorkspace: (workspaceId, name) =>
      call<boolean>("rename_workspace", { p_workspace_id: workspaceId, p_name: name }),
    reportNote: async (clientId, periodStart, periodEnd) =>
      asNote(
        await call<unknown>("client_report_note", {
          p_client_id: clientId,
          p_period_start: periodStart,
          p_period_end: periodEnd,
        }),
      ),
    saveReportNote: (clientId, periodStart, periodEnd, body) =>
      call<boolean>("save_client_report_note", {
        p_client_id: clientId,
        p_period_start: periodStart,
        p_period_end: periodEnd,
        p_body: body,
      }),
    consumeRateLimit: (action) => call<boolean>("consume_rate_limit", { p_action: action }),
    subscription: async (workspaceId) => {
      const { data, error } = await db
        .from("workspace_subscriptions")
        .select(SUBSCRIPTION_COLUMNS)
        .eq("workspace_id", workspaceId)
        .maybeSingle<SubscriptionRow>();
      if (error) throw gatewayError(error);
      return subscriptionFromRow(data);
    },
    createShareLink: async (link) =>
      asCreatedLink(
        await call<unknown>("create_report_share_link", {
          p_client_id: link.clientId,
          p_token: link.token,
          p_preset: link.preset,
          p_period_start: link.periodStart,
          p_period_end: link.periodEnd,
          p_days: link.days,
        }),
      ),
    shareLinks: async (workspaceId) => {
      const { data, error } = await db
        .from("report_share_links")
        .select(SHARE_LINK_COLUMNS)
        .eq("workspace_id", workspaceId)
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .returns<ShareLinkRow[]>();
      if (error) throw gatewayError(error);
      return (data ?? []).map(shareLinkFromRow);
    },
    revokeShareLink: (linkId) =>
      call<boolean>("revoke_report_share_link", { p_link_id: linkId }),
  };
}

export {
  asResult as importWriteResult,
  asNote as reportNoteResult,
  asCreatedLink as createdShareLinkResult,
};

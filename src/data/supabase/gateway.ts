import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportPayload } from "../import/payload";
import type { WorkspaceSnapshot } from "./snapshot";

/**
 * The only path between the application and Postgres. Every call runs as the
 * signed-in user (publishable key + the user's session), so RLS applies; there
 * is no service-role key anywhere in the app.
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
}

export type GatewayErrorKind =
  "forbidden" | "not_found" | "account_mismatch" | "duplicate_name" | "invalid" | "unavailable";

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
  };
}

export { asResult as importWriteResult };

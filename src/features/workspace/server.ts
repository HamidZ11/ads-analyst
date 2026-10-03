import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDemoRepository } from "@/data";
import { supabaseGateway, type WorkspaceGateway } from "@/data/supabase/gateway";
import { snapshotRepository } from "@/data/supabase/snapshot";
import { parseDatePreset } from "@/domain/periods";
import type { Client, ClientDataSource } from "@/domain/types";
import { appMode } from "@/lib/supabase/config";
import { supabaseServerClient } from "@/lib/supabase/server";
import {
  buildContext,
  chooseActive,
  defaultWorkspaceName,
  type WorkspaceContext,
} from "./context";
import { CLIENT_COOKIE, RANGE_COOKIE, WORKSPACE_COOKIE } from "./cookies";

export type { WorkspaceContext } from "./context";

/** Everything a page needs for the selected client (the workspace has at least one). */
export type Workspace = Omit<WorkspaceContext, "client" | "dataSource"> & {
  client: Client;
  dataSource: ClientDataSource;
};

export type SessionState =
  | { kind: "unconfigured" }
  | { kind: "signed_out" }
  | { kind: "unavailable" }
  | { kind: "app"; context: WorkspaceContext; gateway: WorkspaceGateway | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The data access layer. Verifies the session, makes sure the user has a
 * workspace, and loads the active workspace through RLS. Cookies only choose
 * among what the user may access. Never redirects (layouts use it too).
 */
export const loadSession = cache(async (): Promise<SessionState> => {
  // Read cookies first so every app route renders per request, even in a build
  // made before the Supabase variables existed.
  const store = await cookies();
  const mode = appMode();
  if (mode.kind === "unconfigured") return { kind: "unconfigured" };
  const preset = parseDatePreset(store.get(RANGE_COOKIE)?.value);
  const requestedClient = store.get(CLIENT_COOKIE)?.value ?? null;

  if (mode.kind === "demo") {
    const repository = getDemoRepository();
    const agency = repository.getAgency();
    return {
      kind: "app",
      gateway: null,
      context: buildContext({
        mode: "demo",
        user: null,
        workspace: { id: agency.id, name: agency.name },
        repository,
        requestedClientId: requestedClient,
        preset,
        canImport: false,
      }),
    };
  }

  const db = await supabaseServerClient(mode.url, mode.publishableKey);
  const { data, error } = await db.auth.getClaims();
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") return { kind: "signed_out" };
  const email = typeof data?.claims?.email === "string" ? data.claims.email : null;
  const gateway = supabaseGateway(db);
  try {
    const memberships = await gateway.ensureWorkspaces(defaultWorkspaceName(email));
    const workspace = chooseActive(memberships, store.get(WORKSPACE_COOKIE)?.value);
    if (!workspace) return { kind: "unavailable" };
    const snapshot = await gateway.snapshot(
      workspace.id,
      requestedClient && UUID.test(requestedClient) ? requestedClient : null,
    );
    return {
      kind: "app",
      gateway,
      context: buildContext({
        mode: "supabase",
        user: { id: sub, email },
        workspace: { id: workspace.id, name: workspace.name },
        repository: snapshotRepository(snapshot),
        // The database already resolved the selection within this workspace.
        requestedClientId: snapshot.client_id,
        preset,
        canImport: true,
      }),
    };
  } catch (failure) {
    console.error("[ad-analyst] workspace could not be loaded:", (failure as Error).message);
    return { kind: "unavailable" };
  }
});

export class WorkspaceUnavailableError extends Error {
  constructor() {
    super("Your workspace could not be loaded.");
    this.name = "WorkspaceUnavailableError";
  }
}

/** For pages and actions: the workspace, or a redirect to sign in. */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext> => {
  const session = await loadSession();
  if (session.kind === "app") return session.context;
  if (session.kind === "unavailable") throw new WorkspaceUnavailableError();
  redirect("/sign-in");
});

/** For analysis pages: the selected client; an empty workspace goes to its first import. */
export const getWorkspace = cache(async (): Promise<Workspace> => {
  const context = await getWorkspaceContext();
  if (!context.client || !context.dataSource) redirect("/clients/import?client=new");
  return { ...context, client: context.client, dataSource: context.dataSource };
});

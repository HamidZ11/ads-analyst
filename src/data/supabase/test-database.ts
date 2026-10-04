import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  gatewayError,
  importWriteResult,
  type WorkspaceGateway,
  type WorkspaceMembership,
} from "./gateway";
import type { WorkspaceSnapshot } from "./snapshot";

/**
 * Test-only: a real Postgres (PGlite, in process) with the pieces of Supabase
 * the migrations rely on — the anon and authenticated roles, auth.users and
 * auth.uid() reading the JWT subject — then every migration in
 * supabase/migrations applied in order. Policies are exercised by switching to
 * the authenticated role with a chosen subject, exactly as PostgREST does.
 */
const SUPABASE_SHIM = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
`;

export const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export async function createTestDatabase(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_SHIM);
  for (const file of readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  return db;
}

export async function addUser(db: PGlite, id: string, email: string) {
  await db.query("insert into auth.users (id, email) values ($1, $2)", [id, email]);
}

/** Runs `fn` as the authenticated role with `userId` as the JWT subject (or as anon). */
export async function as<T>(
  db: PGlite,
  userId: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(userId ? "set role authenticated" : "set role anon");
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', '', false)");
  }
}

/** The same WorkspaceGateway contract over PGlite, acting as one user. Test-only. */
export function sqlGateway(db: PGlite, userId: string): WorkspaceGateway {
  const run = async <T>(sql: string, params: unknown[]): Promise<T> =>
    as(db, userId, async () => {
      try {
        const result = await db.query<{ r: T }>(sql, params);
        return result.rows[0]?.r as T;
      } catch (error) {
        throw gatewayError(error);
      }
    });
  return {
    ensureWorkspaces: async (defaultName) =>
      as(db, userId, async () => {
        try {
          return (
            await db.query<WorkspaceMembership>(
              "select * from public.ensure_default_workspace($1)",
              [defaultName],
            )
          ).rows;
        } catch (error) {
          throw gatewayError(error);
        }
      }),
    snapshot: (workspaceId, clientId) =>
      run<WorkspaceSnapshot>("select public.workspace_snapshot($1, $2) as r", [
        workspaceId,
        clientId,
      ]),
    importMetaCsv: async (workspaceId, payload) =>
      importWriteResult(
        await run<unknown>("select public.import_meta_csv($1, $2::jsonb) as r", [
          workspaceId,
          JSON.stringify(payload),
        ]),
      ),
    updateTargets: (clientId, targetCpa, targetRoas) =>
      run<boolean>("select public.update_client_targets($1, $2, $3) as r", [
        clientId,
        targetCpa,
        targetRoas,
      ]),
    consumeRateLimit: (action) =>
      run<boolean>("select public.consume_rate_limit($1) as r", [action]),
  };
}

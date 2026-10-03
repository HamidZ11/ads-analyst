/**
 * How this deployment runs, decided once from the environment:
 *
 * - `supabase`: Supabase URL and publishable (anon) key are set. Sign-in is
 *   required and all data comes from the user's workspace in Postgres.
 * - `demo`: no database. The read-only demo dataset is shown without sign-in.
 *   Enabled explicitly with AD_ANALYST_DEMO_MODE=true, or automatically in
 *   development when Supabase is not configured.
 * - `unconfigured`: a production build with neither; every route explains the
 *   missing configuration instead of serving demo data by accident.
 */
export type AppMode =
  | { kind: "supabase"; url: string; publishableKey: string }
  | { kind: "demo" }
  | { kind: "unconfigured" };

type Env = Record<string, string | undefined>;

export function appMode(env: Env = process.env): AppMode {
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (url && publishableKey) return { kind: "supabase", url, publishableKey };
  if (env.AD_ANALYST_DEMO_MODE === "true" || env.NODE_ENV !== "production")
    return { kind: "demo" };
  return { kind: "unconfigured" };
}

/** Whether new email addresses may create an account (default true; each gets its own workspace). */
export function signupsAllowed(env: Env = process.env): boolean {
  return env.AD_ANALYST_ALLOW_SIGNUPS !== "false";
}

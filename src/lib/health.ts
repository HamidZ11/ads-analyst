import { appMode } from "@/lib/supabase/config";

type Env = Record<string, string | undefined>;

/**
 * What /api/health reports: the deployment mode and the commit it was built
 * from, never configuration values. An unconfigured production build is
 * unhealthy (503), so an uptime check catches a deployment missing its
 * Supabase variables. It does not call Supabase: it says whether this
 * deployment is up and configured, not whether the database is reachable.
 * `demoFlagIgnored` flags AD_ANALYST_DEMO_MODE=true on a deployment that has
 * Supabase variables, where the flag has no effect (Supabase wins), so a
 * deployment meant to be the public demo is not mistaken for one.
 */
export function healthReport(env: Env = process.env) {
  const mode = appMode(env).kind;
  const ok = mode !== "unconfigured";
  return {
    status: ok ? 200 : 503,
    body: {
      ok,
      mode,
      demoFlagIgnored: mode === "supabase" && env.AD_ANALYST_DEMO_MODE === "true",
      commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
  };
}

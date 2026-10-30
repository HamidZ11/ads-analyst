import { appMode } from "@/lib/supabase/config";

type Env = Record<string, string | undefined>;

/**
 * What /api/health reports: the deployment mode and the commit it was built
 * from, never configuration values. An unconfigured production build is
 * unhealthy (503), so an uptime check catches a deployment missing its
 * Supabase variables. It does not call Supabase: it says whether this
 * deployment is up and configured, not whether the database is reachable.
 */
export function healthReport(env: Env = process.env) {
  const mode = appMode(env).kind;
  const ok = mode !== "unconfigured";
  return {
    status: ok ? 200 : 503,
    body: {
      ok,
      mode,
      commit: env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
  };
}

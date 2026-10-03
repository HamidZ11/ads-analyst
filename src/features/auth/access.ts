/**
 * Route access rules applied by the proxy before rendering. They are an
 * optimistic, cookie-based check; the data access layer verifies the session
 * again next to the data, and Postgres RLS is the final authority.
 */

import { MARKETING_PATHS } from "@/lib/routes";

/** Routes reachable without a session (besides the marketing pages). */
const PUBLIC_PATHS = ["/sign-in", "/auth/callback"];

/** `redirect_app` sends a signed-in visitor to the app (`APP_HOME`). */
export type AccessDecision = "allow" | "redirect_to_sign_in" | "unauthorized" | "redirect_app";

export function isPublicPath(pathname: string): boolean {
  if ((MARKETING_PATHS as readonly string[]).includes(pathname)) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function accessDecision(pathname: string, signedIn: boolean): AccessDecision {
  // Signed-in people who land on sign-in or the site root go straight to work;
  // the other marketing pages (pricing) stay readable.
  if (signedIn && (pathname === "/sign-in" || pathname === "/")) return "redirect_app";
  if (isPublicPath(pathname)) return "allow";
  if (signedIn) return "allow";
  return pathname === "/api" || pathname.startsWith("/api/")
    ? "unauthorized"
    : "redirect_to_sign_in";
}

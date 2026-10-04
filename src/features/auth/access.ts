/**
 * Route access rules applied by the proxy before rendering. They are an
 * optimistic, cookie-based check; the data access layer verifies the session
 * again next to the data, and Postgres RLS is the final authority.
 */

import { APP_PATHS, MARKETING_PATHS } from "@/lib/routes";

/** Routes reachable without a session (besides the marketing pages). */
const PUBLIC_PATHS = ["/sign-in", "/auth/callback"];

/** `redirect_app` sends a signed-in visitor to the app (`APP_HOME`). */
export type AccessDecision = "allow" | "redirect_to_sign_in" | "unauthorized" | "redirect_app";

const under = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

export function isPublicPath(pathname: string): boolean {
  if ((MARKETING_PATHS as readonly string[]).includes(pathname)) return true;
  return PUBLIC_PATHS.some((p) => under(pathname, p));
}

/** An app page, or anything beneath one. */
export function isAppPath(pathname: string): boolean {
  return APP_PATHS.some((p) => under(pathname, p));
}

export function accessDecision(pathname: string, signedIn: boolean): AccessDecision {
  // Signed-in people who land on sign-in or the site root go straight to work;
  // the other marketing pages (pricing) stay readable.
  if (signedIn && (pathname === "/sign-in" || pathname === "/")) return "redirect_app";
  if (isPublicPath(pathname)) return "allow";
  if (signedIn) return "allow";
  if (under(pathname, "/api")) return "unauthorized";
  // App pages send signed-out visitors to sign-in. Nothing else needs a
  // session: robots.txt, the sitemap and unknown URLs render normally, and an
  // unknown URL gets a real 404 instead of a redirect to sign-in.
  return isAppPath(pathname) ? "redirect_to_sign_in" : "allow";
}

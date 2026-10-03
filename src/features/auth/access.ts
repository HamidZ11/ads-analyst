/**
 * Route access rules applied by the proxy before rendering. They are an
 * optimistic, cookie-based check; the data access layer verifies the session
 * again next to the data, and Postgres RLS is the final authority.
 */

/** Routes reachable without a session. */
const PUBLIC_PATHS = ["/sign-in", "/auth/callback"];

export type AccessDecision = "allow" | "redirect_to_sign_in" | "unauthorized" | "redirect_home";

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function accessDecision(pathname: string, signedIn: boolean): AccessDecision {
  if (isPublicPath(pathname))
    return signedIn && pathname === "/sign-in" ? "redirect_home" : "allow";
  if (signedIn) return "allow";
  return pathname === "/api" || pathname.startsWith("/api/")
    ? "unauthorized"
    : "redirect_to_sign_in";
}

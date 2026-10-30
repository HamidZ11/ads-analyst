import { isAppPath } from "./access";

/**
 * Where to go after signing in (D-089). Only a path to an
 * app page on this site is accepted, so a crafted `next` can never send
 * someone to another origin (open redirect) or into the API or auth routes.
 */

/** Holds the validated return path between the sign-in form and the emailed link. */
export const RETURN_COOKIE = "aa_return_to";
export const RETURN_COOKIE_MAX_AGE = 60 * 60;

/** Pricing's Subscribe, once Checkout is configured: Settings → Billing. */
export const BILLING_RETURN_PATH = "/settings#billing";

const BASE = "https://return.invalid";

export function safeReturnPath(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 200) return null;
  // One leading slash, then no slash or backslash: rules out `//host` and `/\host`.
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return null;
  // Control characters and spaces are stripped or rewritten by URL parsers.
  if (/[\u0000- \u007f]/.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE || !isAppPath(url.pathname)) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** `/sign-in?next=…` for a validated path; plain `/sign-in` otherwise. */
export function signInHref(next: string): string {
  const safe = safeReturnPath(next);
  return safe ? `/sign-in?next=${encodeURIComponent(safe)}` : "/sign-in";
}

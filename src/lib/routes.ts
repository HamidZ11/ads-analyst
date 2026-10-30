/**
 * Top-level routes shared by the app, the marketing site and the proxy.
 * Kept free of UI imports so the proxy bundle stays small.
 */

/** The Overview page. */
export const OVERVIEW_PATH = "/overview";

/**
 * Where the app starts: Insights, so a session opens on what needs attention.
 * Sign-in, the email callback, a signed-in visit to the site root and "Try the
 * demo" land here. The site root is the public landing page.
 */
export const APP_HOME = "/insights";

/** The free calculators (D-095): an index and one page per tool. */
export const TOOL_PATHS = [
  "/tools",
  "/tools/roas-calculator",
  "/tools/cpa-calculator",
  "/tools/break-even-roas-calculator",
] as const;

/** Public marketing pages: reachable signed out, rendered without the app shell. */
export const MARKETING_PATHS = [
  "/",
  "/audit",
  "/pricing",
  "/privacy",
  "/terms",
  ...TOOL_PATHS,
] as const;

/** The self-serve wasted-spend audit (D-083), where the calculators send people. */
export const AUDIT_PATH = "/audit";

export type MarketingPath = (typeof MARKETING_PATHS)[number];

/**
 * The app's pages (each path and everything beneath it). They need a session,
 * or demo mode; the proxy sends signed-out visitors to sign-in. Other unknown
 * paths are not sent there: they render a real 404.
 */
export const APP_PATHS = [
  OVERVIEW_PATH,
  "/campaigns",
  "/creatives",
  "/insights",
  "/ask",
  "/report",
  "/clients",
  "/settings",
] as const;

/** Read-only client reports opened by a share link: `/r/<token>` (D-NEW-share-1). */
export const SHARED_REPORT_PATH = "/r";

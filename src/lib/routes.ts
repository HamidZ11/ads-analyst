/**
 * Top-level routes shared by the app, the marketing site and the proxy.
 * Kept free of UI imports so the proxy bundle stays small.
 */

/** Where the app starts: the Overview. The site root is the public landing page. */
export const APP_HOME = "/overview";

/** Public marketing pages: reachable signed out, rendered without the app shell. */
export const MARKETING_PATHS = ["/", "/pricing"] as const;

export type MarketingPath = (typeof MARKETING_PATHS)[number];

/**
 * The app's pages (each path and everything beneath it). They need a session,
 * or demo mode; the proxy sends signed-out visitors to sign-in. Other unknown
 * paths are not sent there: they render a real 404.
 */
export const APP_PATHS = [
  APP_HOME,
  "/campaigns",
  "/creatives",
  "/insights",
  "/ask",
  "/clients",
  "/settings",
] as const;

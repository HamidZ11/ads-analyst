/**
 * Top-level routes shared by the app, the marketing site and the proxy.
 * Kept free of UI imports so the proxy bundle stays small.
 */

/** Where the app starts: the Overview. The site root is the public landing page. */
export const APP_HOME = "/overview";

/** Public marketing pages: reachable signed out, rendered without the app shell. */
export const MARKETING_PATHS = ["/", "/pricing"] as const;

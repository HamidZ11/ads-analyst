/**
 * The public origin of the production site, used for canonical URLs, the
 * sitemap, robots.txt and structured data. One source: NEXT_PUBLIC_SITE_URL,
 * the same variable sign-in emails use. Set it in the build environment, since
 * robots.txt and the sitemap are generated at build time.
 */

type Env = Record<string, string | undefined>;

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "0.0.0.0"]);

/**
 * `https://example.com` (no trailing slash), or null when the variable is
 * unset, not an http(s) URL, or a loopback host. Null means "no production
 * domain yet": canonical tags, sitemap entries and the sitemap line in
 * robots.txt are left out rather than pointing at localhost.
 */
export function publicOrigin(env: Env = process.env): string | null {
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (LOOPBACK.has(url.hostname) || url.hostname.endsWith(".localhost")) return null;
  return url.origin;
}

/**
 * The absolute URL of a site path, without a trailing slash: the home page is
 * the bare origin, exactly as Next.js renders it in the canonical tag, so the
 * canonical, sitemap and structured data all use the same string.
 */
export function absoluteUrl(origin: string, path: string): string {
  return path === "/" ? origin : `${origin}${path}`;
}

/** The default for every route: not indexed, links not followed. */
export const NOT_INDEXED = { index: false, follow: false } as const;

/** Public pages opt in. Only the marketing layout uses this. */
export const INDEXED = { index: true, follow: true } as const;

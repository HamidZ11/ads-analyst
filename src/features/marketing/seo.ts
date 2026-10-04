import type { Metadata, MetadataRoute } from "next";
import { MARKETING_PATHS, type MarketingPath } from "@/lib/routes";
import { absoluteUrl, publicOrigin } from "@/lib/site";

/* Search and sharing for the public site. Only the marketing pages are
   indexable (their layout opts in); the app, sign-in and 404s inherit the root
   layout's noindex. Canonical URLs, sitemap entries and the site's URL in
   structured data appear only when a production origin is configured. */

export const SITE_NAME = "Ad Analyst";

/** One title and description per public page; each is unique and fits a search snippet. */
export const MARKETING_PAGES: Record<MarketingPath, { title: string; description: string }> = {
  "/": {
    title: "Ad Analyst — Meta Ads analysis for agencies",
    description:
      "Ad Analyst shows agencies which Meta Ads campaigns and creatives changed, how each client compares with its targets, and where spend is being wasted.",
  },
  "/pricing": {
    title: "Pricing — Ad Analyst",
    description:
      "The Agency plan is £29 a month, or £290 a year, for up to 10 client accounts. Agencies managing more than 10 get custom Enterprise pricing.",
  },
};

/** Title, description, canonical URL and Open Graph for one marketing page. */
export function marketingMetadata(
  path: MarketingPath,
  origin: string | null = publicOrigin(),
): Metadata {
  const { title, description } = MARKETING_PAGES[path];
  const url = origin ? absoluteUrl(origin, path) : undefined;
  return {
    title: { absolute: title },
    description,
    alternates: url ? { canonical: url } : undefined,
    // No image: there is no approved share artwork yet, so cards stay text-only.
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_GB",
      title,
      description,
      url,
    },
  };
}

/**
 * Crawl everything public. The API and the email callback are never useful to
 * a crawler. App pages are not disallowed: they answer signed-out crawlers with
 * a redirect to sign-in and carry noindex, which a crawler can only see if it
 * may fetch them. Access control is the proxy, the data layer and RLS, not this.
 */
export function robotsFor(origin: string | null): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] },
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
  };
}

/** The canonical public URLs, and nothing else. Empty until an origin is configured. */
export function sitemapFor(origin: string | null): MetadataRoute.Sitemap {
  if (!origin) return [];
  return MARKETING_PATHS.map((path) => ({ url: absoluteUrl(origin, path) }));
}

/**
 * The home page's structured data: the site's name for search results
 * (WebSite, which needs the canonical home URL) and the product
 * (SoftwareApplication). The description is the hero lead, as shown on the
 * page. No offers, because prices are not on the home page; no ratings or
 * reviews, because none exist.
 */
export function homeStructuredData(origin: string | null = publicOrigin()) {
  const url = origin ? absoluteUrl(origin, "/") : undefined;
  const product = {
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Ad Analyst shows agencies the campaign and creative changes that matter, before the reporting meeting starts.",
    ...(url ? { url } : {}),
  };
  return {
    "@context": "https://schema.org",
    "@graph": url ? [{ "@type": "WebSite", name: SITE_NAME, url }, product] : [product],
  };
}

/** JSON for a `<script type="application/ld+json">`, with `<` escaped so it cannot close the tag. */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage, { metadata as landingMetadata } from "@/app/(marketing)/page";
import { metadata as pricingMetadata } from "@/app/(marketing)/pricing/page";
import { APP_HOME, APP_PATHS, MARKETING_PATHS } from "@/lib/routes";
import { INDEXED, NOT_INDEXED, publicOrigin } from "@/lib/site";
import {
  homeStructuredData,
  jsonLd,
  MARKETING_PAGES,
  marketingMetadata,
  robotsFor,
  sitemapFor,
} from "./seo";

const ORIGIN = "https://ad-analyst.example";

describe("public origin", () => {
  it("is null until a real production origin is configured", () => {
    expect(publicOrigin({})).toBeNull();
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: "" })).toBeNull();
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: "not a url" })).toBeNull();
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: "ftp://ad-analyst.example" })).toBeNull();
    for (const local of [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://app.localhost",
    ])
      expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: local }), local).toBeNull();
  });

  it("normalises to scheme and host, without a trailing slash or path", () => {
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: `${ORIGIN}/` })).toBe(ORIGIN);
    expect(publicOrigin({ NEXT_PUBLIC_SITE_URL: ` ${ORIGIN}/some/path ` })).toBe(ORIGIN);
  });
});

describe("marketing metadata", () => {
  it("gives each public page a unique title and a description that fits a snippet", () => {
    const titles = MARKETING_PATHS.map((path) => MARKETING_PAGES[path].title);
    expect(new Set(titles).size).toBe(titles.length);
    for (const path of MARKETING_PATHS) {
      const { description } = MARKETING_PAGES[path];
      expect(description.length, path).toBeGreaterThan(70);
      expect(description.length, path).toBeLessThanOrEqual(160);
    }
  });

  it("uses those titles and descriptions on the pages themselves", () => {
    expect(landingMetadata.title).toEqual({ absolute: MARKETING_PAGES["/"].title });
    expect(landingMetadata.description).toBe(MARKETING_PAGES["/"].description);
    expect(pricingMetadata.title).toEqual({ absolute: "Pricing — Ad Analyst" });
    expect(pricingMetadata.description).toBe(MARKETING_PAGES["/pricing"].description);
  });

  it("describes pricing truthfully: £29 Agency and Enterprise beyond 10 clients", () => {
    const { description } = MARKETING_PAGES["/pricing"];
    expect(description).toContain("£29 a month");
    expect(description).toContain("£290 a year");
    expect(description).toContain("Enterprise");
  });

  it("points each page's canonical URL at itself on the configured origin", () => {
    expect(marketingMetadata("/", ORIGIN).alternates?.canonical).toBe(ORIGIN);
    expect(marketingMetadata("/pricing", ORIGIN).alternates?.canonical).toBe(
      `${ORIGIN}/pricing`,
    );
    expect(marketingMetadata("/pricing", ORIGIN).openGraph?.url).toBe(`${ORIGIN}/pricing`);
  });

  it("omits canonical and Open Graph URLs rather than guessing an origin", () => {
    const metadata = marketingMetadata("/pricing", null);
    expect(metadata.alternates).toBeUndefined();
    expect(metadata.openGraph?.url).toBeUndefined();
    expect(JSON.stringify(metadata)).not.toContain("localhost");
  });

  it("indexes the marketing pages and nothing else by default", () => {
    expect(INDEXED).toEqual({ index: true, follow: true });
    expect(NOT_INDEXED).toEqual({ index: false, follow: false });
    // Pages must not override the layout's robots policy.
    expect(landingMetadata.robots).toBeUndefined();
    expect(pricingMetadata.robots).toBeUndefined();
  });
});

describe("sitemap and robots", () => {
  it("lists exactly the canonical public URLs", () => {
    const urls = sitemapFor(ORIGIN).map((entry) => entry.url);
    expect(urls).toEqual([ORIGIN, `${ORIGIN}/pricing`]);
    for (const path of [...APP_PATHS, "/sign-in", "/auth/callback"])
      expect(
        urls.some((url) => url.startsWith(`${ORIGIN}${path}`)),
        path,
      ).toBe(false);
  });

  it("is empty without a configured origin", () => {
    expect(sitemapFor(null)).toEqual([]);
  });

  it("never blocks the site, and names the sitemap only when there is one", () => {
    const robots = robotsFor(ORIGIN);
    const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules];
    for (const rule of rules) {
      expect(rule.allow).toBe("/");
      const disallow = ([] as string[]).concat(rule.disallow ?? []);
      for (const path of [...MARKETING_PATHS, ""]) expect(disallow).not.toContain(path);
    }
    expect(robots.sitemap).toBe(`${ORIGIN}/sitemap.xml`);
    expect(robotsFor(null).sitemap).toBeUndefined();
  });
});

describe("structured data", () => {
  const html = renderToStaticMarkup(createElement(LandingPage));

  it("describes the product with facts shown on the page, and no invented ratings", () => {
    const data = homeStructuredData(ORIGIN);
    const product = data["@graph"].find((node) => node["@type"] === "SoftwareApplication");
    const description = product && "description" in product ? product.description : "";
    expect(description).not.toBe("");
    expect(html).toContain(description);
    const text = JSON.stringify(data);
    for (const forbidden of ["aggregateRating", "review", "offers", "FAQPage", "Breadcrumb"])
      expect(text, forbidden).not.toContain(forbidden);
  });

  it("names the site only when its canonical home URL is known", () => {
    expect(homeStructuredData(ORIGIN)["@graph"][0]).toEqual({
      "@type": "WebSite",
      name: "Ad Analyst",
      url: ORIGIN,
    });
    expect(JSON.stringify(homeStructuredData(null))).not.toContain("WebSite");
  });

  it("is rendered on the home page as safely escaped JSON-LD", () => {
    expect(html).toContain('<script type="application/ld+json">');
    expect(jsonLd({ text: "</script>" })).toBe('{"text":"\\u003c/script>"}');
  });
});

describe("public links", () => {
  const root = process.cwd();
  const sources = [
    ...readdirSync(join(root, "src/app/(marketing)"), { recursive: true, encoding: "utf8" })
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => join(root, "src/app/(marketing)", file)),
    ...readdirSync(join(root, "src/features/marketing"))
      .filter((file) => file.endsWith(".tsx"))
      .map((file) => join(root, "src/features/marketing", file)),
  ].map((file) => readFileSync(file, "utf8"));
  const hrefs = sources.flatMap((source) =>
    [...source.matchAll(/href[=:]\s*"([^"]*)"/g)].map((match) => match[1]),
  );
  const landing = readFileSync(join(root, "src/app/(marketing)/page.tsx"), "utf8");

  it("only links to pages that exist, and to anchors on the home page", () => {
    expect(hrefs.length).toBeGreaterThan(5);
    const pages = new Set<string>([...MARKETING_PATHS, "/sign-in", APP_HOME]);
    for (const href of hrefs) {
      expect(href, "empty href").not.toBe("");
      expect(href, href).not.toMatch(/-lab\b|mailto:|^#$/);
      const [path, anchor] = href.split("#");
      if (path) expect(pages.has(path), href).toBe(true);
      if (anchor && anchor !== "content")
        expect(landing.includes(`id="${anchor}"`), href).toBe(true);
    }
  });
});

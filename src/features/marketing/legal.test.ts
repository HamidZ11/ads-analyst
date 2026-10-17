import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata as privacyMetadata } from "@/app/(marketing)/privacy/page";
import TermsPage, { metadata as termsMetadata } from "@/app/(marketing)/terms/page";
import { isPublicPath } from "@/features/auth/access";
import { MARKETING_PATHS } from "@/lib/routes";
import { ContactUs } from "./legal";
import { MarketingFooter } from "./marketing-footer";
import { MARKETING_PAGES } from "./seo";

const pages = [
  { path: "/privacy", file: "privacy", Page: PrivacyPage, metadata: privacyMetadata },
  { path: "/terms", file: "terms", Page: TermsPage, metadata: termsMetadata },
] as const;

describe("legal pages", () => {
  for (const { path, file, Page, metadata } of pages) {
    const html = renderToStaticMarkup(createElement(Page));

    it(`${path} is a public, indexable marketing page with one heading`, () => {
      expect(MARKETING_PATHS).toContain(path);
      expect(isPublicPath(path)).toBe(true);
      expect(metadata.title).toEqual({ absolute: MARKETING_PAGES[path].title });
      expect(html.match(/<h1/g)?.length).toBe(1);
    });

    it(`${path} is marked as a draft pending review at the top of its file`, () => {
      const source = readFileSync(
        join(process.cwd(), `src/app/(marketing)/${file}/page.tsx`),
        "utf8",
      );
      expect(source.trimStart()).toMatch(/^\/\*\s*\*?\s*DRAFT — PENDING REVIEW/);
    });

    it(`${path} renders no mailto without a configured contact address`, () => {
      expect(html).not.toContain("mailto:");
      expect(html).toContain("contact us");
    });
  }

  it("covers storage, purpose, location, retention, deletion and no sale of data", () => {
    const html = renderToStaticMarkup(createElement(PrivacyPage));
    for (const heading of [
      "What we store",
      "Why we store it",
      "Where it is kept",
      "How long we keep it",
      "Deleting your data",
    ])
      expect(html, heading).toContain(`>${heading}</h2>`);
    expect(html).toContain("Supabase");
    expect(html).toContain("We do not sell your data");
  });

  it("links the contact address when one is configured", () => {
    const html = renderToStaticMarkup(
      createElement(ContactUs, { email: "privacy@ad-analyst.example" }),
    );
    expect(html).toBe(
      'email us at <a href="mailto:privacy@ad-analyst.example">privacy@ad-analyst.example</a>',
    );
  });

  it("are linked from the footer", () => {
    const html = renderToStaticMarkup(createElement(MarketingFooter));
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
  });
});

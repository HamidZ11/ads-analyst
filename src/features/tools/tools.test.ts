import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Metadata } from "next";
import { describe, expect, it } from "vitest";
import BreakEven, {
  metadata as breakEvenMetadata,
} from "@/app/(marketing)/tools/break-even-roas-calculator/page";
import Cpa, { metadata as cpaMetadata } from "@/app/(marketing)/tools/cpa-calculator/page";
import ToolsIndex, { metadata as indexMetadata } from "@/app/(marketing)/tools/page";
import Roas, { metadata as roasMetadata } from "@/app/(marketing)/tools/roas-calculator/page";
import { accessDecision } from "@/features/auth/access";
import { MarketingFooter } from "@/features/marketing/marketing-footer";
import {
  MARKETING_PAGES,
  marketingMetadata,
  toolsIndexStructuredData,
  toolStructuredData,
} from "@/features/marketing/seo";
import { AUDIT_PATH, TOOL_PATHS } from "@/lib/routes";
import { TOOLS, type ToolId } from "./catalog";

const ORIGIN = "https://ad-analyst.example";

const PAGES: { id: ToolId; Page: ComponentType; metadata: Metadata }[] = [
  { id: "roas", Page: Roas, metadata: roasMetadata },
  { id: "cpa", Page: Cpa, metadata: cpaMetadata },
  { id: "break-even-roas", Page: BreakEven, metadata: breakEvenMetadata },
];

const render = (Page: ComponentType) => renderToStaticMarkup(createElement(Page));

/** Words that would claim a benchmark or comparison the product has no data for. */
const INVENTED =
  /industry average|benchmark|average roas|typical roas|good roas is|average cpa/i;

describe("tools index", () => {
  const html = render(ToolsIndex);

  it("lists the three calculators, each linking to its page with its formula", () => {
    expect(html).toContain(">Free ad calculators</h1>");
    for (const tool of TOOLS) {
      expect(html).toContain(`href="${tool.path}"`);
      expect(html).toContain(tool.name);
      expect(html).toContain(tool.formula);
    }
  });

  it("ends with the audit as the filled call to action", () => {
    expect(html).toMatch(new RegExp(`<a class="[^"]*button[^"]*" href="${AUDIT_PATH}">`));
    expect(html).toContain("Get a free wasted-spend audit");
  });

  it("has its own metadata and a list of WebApplications as structured data", () => {
    expect(indexMetadata.title).toEqual({ absolute: MARKETING_PAGES["/tools"].title });
    expect(indexMetadata.description).toBe(MARKETING_PAGES["/tools"].description);
    expect(html).toContain('<script type="application/ld+json">');
    const data = toolsIndexStructuredData(ORIGIN);
    expect(data["@type"]).toBe("ItemList");
    expect(data.url).toBe(`${ORIGIN}/tools`);
    expect(data.itemListElement.map((entry) => entry.item.url)).toEqual(
      TOOLS.map((tool) => `${ORIGIN}${tool.path}`),
    );
  });
});

describe.each(PAGES)("$id calculator page", ({ id, Page, metadata }) => {
  const tool = TOOLS.find((candidate) => candidate.id === id)!;
  const html = render(Page);

  it("shows the name, the formula, an explanation and the audit", () => {
    expect(html).toContain(`>${tool.name}</h1>`);
    expect(html).toContain(tool.formula);
    expect(html.match(/<h2/g)!.length).toBeGreaterThanOrEqual(4);
    expect(html).toContain(`href="${AUDIT_PATH}"`);
    expect(html).toContain('href="/tools"');
  });

  it("links to the other two tools, not itself", () => {
    const others = html.slice(html.indexOf('aria-labelledby="other-tools"'));
    for (const other of TOOLS)
      expect(others.includes(`href="${other.path}"`), other.path).toBe(other.id !== id);
  });

  it("labels every input and starts with an empty, honest result", () => {
    const ids = [...html.matchAll(/<input[^>]*id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    for (const inputId of ids) expect(html).toContain(`for="${inputId}"`);
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('<legend class="');
    expect(html.match(/type="radio"/g)?.length).toBe(3);
    for (const code of ["GBP", "USD", "EUR"]) expect(html).toContain(`value="${code}"`);
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).not.toMatch(/NaN|Infinity/);
  });

  it("claims no benchmarks or averages", () => {
    expect(html).not.toMatch(INVENTED);
  });

  it("has its own metadata, canonical URL and WebApplication structured data", () => {
    expect(metadata.title).toEqual({ absolute: MARKETING_PAGES[tool.path].title });
    expect(metadata.description).toBe(MARKETING_PAGES[tool.path].description);
    expect(marketingMetadata(tool.path, ORIGIN).alternates?.canonical).toBe(
      `${ORIGIN}${tool.path}`,
    );
    const data = toolStructuredData(id, ORIGIN);
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: tool.name,
      operatingSystem: "Web",
      isAccessibleForFree: true,
      url: `${ORIGIN}${tool.path}`,
    });
    expect(html).toContain(tool.summary);
    for (const forbidden of ["aggregateRating", "review", "offers"])
      expect(JSON.stringify(data), forbidden).not.toContain(forbidden);
    expect(JSON.stringify(toolStructuredData(id, null))).not.toContain('"url"');
  });
});

describe("routing", () => {
  it("serves every tool page signed out, and does not open the rest of /tools", () => {
    for (const path of TOOL_PATHS) {
      expect(accessDecision(path, false), path).toBe("allow");
      expect(accessDecision(path, true), path).toBe("allow");
    }
    expect(TOOL_PATHS).toEqual(["/tools", ...TOOLS.map((tool) => tool.path)]);
  });

  it("links the index from the footer", () => {
    expect(renderToStaticMarkup(createElement(MarketingFooter, { email: null }))).toContain(
      '<a href="/tools">Free tools</a>',
    );
  });
});

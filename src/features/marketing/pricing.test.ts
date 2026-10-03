import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PricingPage from "@/app/(marketing)/pricing/page";

describe("pricing page", () => {
  const html = renderToStaticMarkup(createElement(PricingPage));

  it("keeps one Agency plan at £29 a month with the annual line", () => {
    expect(html).toContain(">Agency<");
    expect(html).toMatch(/£<\/span>29/);
    expect(html).toContain("/ month");
    expect(html).toContain("£290/year · 2 months free");
    expect(html).toContain("Up to 10 client accounts");
    expect(html).toContain("Try the demo");
  });

  it("presents Agency and Enterprise as two plan panels that differ in capacity", () => {
    expect(html.match(/<article/g)?.length).toBe(2);
    expect(html).toContain(">Enterprise<");
    expect(html).toContain("For agencies managing more than 10 client accounts.");
    expect(html).toContain(">Custom<");
    expect(html).toContain(">pricing<");
    expect(html).toContain("The same product, with room for every client.");
    expect(html).toContain("More than 10 client accounts");
    expect(html).toContain("Email us for pricing");
  });

  it("lists the shared product once, beneath both plans", () => {
    expect(html).toContain("Included in both plans");
    for (const item of [
      "Meta Ads CSV imports",
      "Deterministic Insights",
      "Previous-period comparisons",
    ])
      expect(html.split(item).length - 1, item).toBe(1);
  });

  it("does not invent a contact destination", () => {
    expect(html).not.toContain("mailto:");
    expect(html).not.toMatch(/<a[^>]*>[^<]*(Email us|Contact us)/);
  });

  it("keeps a single top-level heading", () => {
    expect(html.match(/<h1/g)?.length).toBe(1);
  });
});

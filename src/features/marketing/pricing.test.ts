import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import PricingPage from "@/app/(marketing)/pricing/page";

describe("pricing page", () => {
  const html = renderToStaticMarkup(createElement(PricingPage));

  it("keeps one Agency plan at £99 a month with the annual line", () => {
    expect(html).toContain(">Agency<");
    expect(html).toMatch(/£<\/span>99/);
    expect(html).toContain("/ month");
    expect(html).toContain("£990/year · 2 months free");
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

  it("hides the Enterprise contact when no address is configured", () => {
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("Email us");
  });

  it("keeps a single top-level heading", () => {
    expect(html.match(/<h1/g)?.length).toBe(1);
  });
});

describe("pricing page with a contact address", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function render(email: string) {
    vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", email);
    vi.resetModules();
    const { default: Page } = await import("@/app/(marketing)/pricing/page");
    return renderToStaticMarkup(createElement(Page));
  }

  it("links Enterprise's Email us to that address", async () => {
    const html = await render("sales@ad-analyst.example");
    expect(html).toContain(
      'href="mailto:sales@ad-analyst.example?subject=Ad%20Analyst%20Enterprise"',
    );
    expect(html).toMatch(/<a[^>]*mailto:[^>]*>Email us for pricing<\/a>/);
  });

  it("treats an invalid address as unset", async () => {
    const html = await render("not an address");
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("Email us");
  });
});

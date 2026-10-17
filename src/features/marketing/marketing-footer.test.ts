import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LINKEDIN_URL, MarketingFooter } from "./marketing-footer";

const render = (email: string | null) =>
  renderToStaticMarkup(createElement(MarketingFooter, { email }));

describe("marketing footer", () => {
  it("lists the footer nav in order", () => {
    const html = render(null);
    const nav = html.slice(html.indexOf("<nav"), html.indexOf("</nav>"));
    const links = [...nav.matchAll(/<a href="([^"]+)">([^<]+)<\/a>/g)].map(
      ([, href, label]) => `${label} ${href}`,
    );
    expect(links).toEqual([
      "Product /#product",
      "How it works /#how-it-works",
      "Pricing /pricing",
      "Privacy /privacy",
      "Terms /terms",
      "Sign in /sign-in",
    ]);
  });

  it("credits the builder with LinkedIn, and the contact address only when set", () => {
    const without = render(null);
    expect(without).toContain("Built by Hamid Aziz in Manchester");
    expect(without).toContain(`href="${LINKEDIN_URL}"`);
    expect(LINKEDIN_URL).toBe("https://www.linkedin.com/in/hamid-aziz-05858a33b/");
    expect(without).not.toContain("mailto:");
    expect(render("hello@ad-analyst.example")).toContain(
      '<a href="mailto:hello@ad-analyst.example">hello@ad-analyst.example</a>',
    );
  });

  it("sets the wordmark as decoration, outside the accessibility tree", () => {
    expect(render(null)).toMatch(
      /<div aria-hidden="true" class="[^"]*footerWordmark[^"]*"><span>Ad Analyst<\/span><\/div>/,
    );
  });
});

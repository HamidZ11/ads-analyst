import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "@/app/(marketing)/page";
import PricingPage from "@/app/(marketing)/pricing/page";
import PrivacyPage from "@/app/(marketing)/privacy/page";
import TermsPage from "@/app/(marketing)/terms/page";
import { CtaBand } from "./cta-band";

const render = (component: () => React.ReactNode) =>
  renderToStaticMarkup(createElement(component));

describe("closing call to action", () => {
  it("closes the landing and pricing pages, and not the legal pages", () => {
    for (const page of [LandingPage, PricingPage]) {
      const html = render(page);
      expect(html.split('id="cta-title"').length - 1).toBe(1);
      expect(html).toContain("See what your client accounts are wasting.");
      expect(html).not.toContain("Know what changed before your next client call");
    }
    for (const page of [PrivacyPage, TermsPage])
      expect(render(page)).not.toContain("cta-title");
  });

  it("leads with the audit mailto and the demo as a text link when an address is set", () => {
    const html = renderToStaticMarkup(
      createElement(CtaBand, { email: "hello@ad-analyst.example" }),
    );
    expect(html).toMatch(
      /<a href="mailto:hello@ad-analyst\.example\?subject=Wasted-spend%20audit%20request&amp;body=[^"]+" class="[^"]*button[^"]*">Get a free wasted-spend audit<\/a>/,
    );
    expect(html).toMatch(/<a class="[^"]*textLink[^"]*" href="\/insights">Try the demo/);
    expect(html).toContain("audit your clients’ Meta Ads spend for free");
  });

  it("makes the demo the primary and drops the audit wording without an address", () => {
    const html = renderToStaticMarkup(createElement(CtaBand, { email: null }));
    expect(html).not.toContain("mailto:");
    expect(html).not.toMatch(/audit/i);
    expect(html).toMatch(/<a class="[^"]*button[^"]*" href="\/insights">Try the demo<\/a>/);
  });
});

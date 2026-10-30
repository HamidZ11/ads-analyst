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

  it("leads with the self-serve audit and the demo as a text link, like the hero", () => {
    const html = renderToStaticMarkup(createElement(CtaBand));
    expect(html).toMatch(
      /<a class="[^"]*button[^"]*" href="\/audit">Get a free wasted-spend audit<\/a>/,
    );
    expect(html).toMatch(/<a class="[^"]*textLink[^"]*" href="\/insights">Try the demo/);
    expect(html).toContain("the file never leaves your browser");
    expect(html).not.toContain("mailto:");
  });
});

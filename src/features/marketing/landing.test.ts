import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "@/app/(marketing)/page";
import { countsPhrase } from "@/domain/insights";
import { landingEvidence } from "./evidence";

const html = renderToStaticMarkup(createElement(LandingPage));
/** Text as React writes it into HTML. */
const escaped = (text: string) => text.replaceAll("&", "&amp;").replaceAll("'", "&#x27;");
const section = (id: string) => {
  const start = html.indexOf(`<section id="${id}"`);
  return html.slice(start, html.indexOf("</section>", start));
};

describe("landing: this week for the client", () => {
  const product = section("product");
  const { insights, weekRows } = landingEvidence();

  it("sums up the client's real findings", () => {
    expect(product).toContain(">This week for Luxe Skin Co.<");
    expect(product).toContain(`>${countsPhrase(insights.counts)}.<`);
    expect(countsPhrase(insights.counts)).toBe(
      "3 issues need attention, 3 opportunities and 2 things to watch",
    );
  });

  it("shows real list rows covering an issue, the scaling winner and a watch item", () => {
    expect(weekRows.map((f) => f.priority)).toEqual([
      "high",
      "opportunity",
      "opportunity",
      "watch",
    ]);
    expect(weekRows.map((f) => f.detector)).toContain("scaling_winner");
    for (const finding of weekRows) {
      expect(insights.findings).toContain(finding);
      expect(product).toContain(escaped(finding.headline));
    }
    expect(product.match(/<li>/g)?.length).toBe(4);
    for (const rule of ["before:bg-negative", "before:bg-positive", "before:bg-warning"])
      expect(product).toContain(rule);
  });

  it("no longer repeats the hero's full zero-conversion finding", () => {
    expect(product).not.toContain(escaped(landingEvidence().zeroConversion.headline));
    expect(html).not.toContain("Why this was flagged");
  });
});

describe("landing: what is cut", () => {
  it("drops the Ask Analyst and Creatives sections", () => {
    expect(html).not.toContain('id="ask-title"');
    expect(html).not.toContain('id="creatives-title"');
    expect(html).not.toContain("Ask the account a question.");
    expect(html).not.toContain("See which creatives are carrying the account.");
  });

  it("points to the rest of the product in the demo, under how it works", () => {
    const steps = html.indexOf('id="how-it-works"');
    const line = html.indexOf("See Campaigns, Creatives and Ask Analyst in the demo");
    expect(line).toBeGreaterThan(steps);
    expect(html.slice(line - 200, line)).toMatch(
      /<a class="[^"]*textLink[^"]*" href="\/insights">$/,
    );
  });
});

describe("landing: page outline", () => {
  it("is the hero, a week of Insights, the multi-client section and the closing band, in order", () => {
    // Only the page's own sections: the product crops contain the app's sections too.
    const labels = [
      ...html.matchAll(
        /<section[^>]*class="[^"]*container[^"]*"[^>]*aria-label(?:ledby)?="([^"]+)"/g,
      ),
    ].map(([, label]) => label);
    expect(labels).toEqual([
      "landing-title",
      "Ad Analyst Overview",
      "week-title",
      "agency-title",
      "cta-title",
    ]);
  });
});

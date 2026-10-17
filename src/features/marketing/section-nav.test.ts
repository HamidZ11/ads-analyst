import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "@/app/(marketing)/page";
import { LANDING_SECTIONS, SectionLink } from "./section-nav";

describe("section navigation", () => {
  it("links to the landing section by hash, marked as the location when current", () => {
    const render = (current: boolean) =>
      renderToStaticMarkup(
        createElement(
          SectionLink,
          { section: "how-it-works", current } as Parameters<typeof SectionLink>[0],
          "How it works",
        ),
      );
    expect(render(false)).toBe('<a href="/#how-it-works">How it works</a>');
    expect(render(true)).toBe(
      '<a aria-current="location" href="/#how-it-works">How it works</a>',
    );
  });

  it("targets sections that exist, can take focus and clear the sticky bar", () => {
    const html = renderToStaticMarkup(createElement(LandingPage));
    for (const id of LANDING_SECTIONS)
      expect(html).toMatch(new RegExp(`id="${id}" tabindex="-1"`));
    const css = readFileSync(
      join(process.cwd(), "src/app/(marketing)/landing.module.css"),
      "utf8",
    );
    expect(css.match(/scroll-margin-top: calc\(var\(--nav-height\) \+ 24px\);/g)?.length).toBe(
      2,
    );
    const site = readFileSync(
      join(process.cwd(), "src/features/marketing/marketing.module.css"),
      "utf8",
    );
    expect(site).toMatch(/\.navBar \{\s*position: sticky;\s*top: 0;/);
    expect(site).toContain("--nav-height: 76px;");
    expect(site).toContain("--nav-height: 64px;");
  });
});

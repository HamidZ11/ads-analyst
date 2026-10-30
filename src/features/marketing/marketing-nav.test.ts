import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const path = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => path.current }));

const { MarketingNav } = await import("./marketing-nav");
const s = (await import("./marketing.module.css")).default;

/** The class lists on the two "Try the demo" links (the bar's and the phone menu's). */
function demoClasses(pathname: string) {
  path.current = pathname;
  const html = renderToStaticMarkup(createElement(MarketingNav));
  return [...html.matchAll(/<a[^>]*class="([^"]*)"[^>]*>Try the demo<\/a>/g)].map((m) => m[1]);
}

describe("the marketing nav's Try the demo", () => {
  it("is filled on every page but the audit", () => {
    for (const pathname of ["/", "/pricing", "/tools"]) {
      const classes = demoClasses(pathname);
      expect(classes).toHaveLength(2);
      for (const list of classes) expect(list).not.toContain(s.secondary);
    }
  });

  it("steps back to the secondary style on /audit, where the drop zone leads", () => {
    expect(s.secondary).toBeTruthy();
    const classes = demoClasses("/audit");
    expect(classes).toHaveLength(2);
    for (const list of classes) expect(list).toContain(s.secondary);
  });
});

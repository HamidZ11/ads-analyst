import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import LandingPage from "@/app/(marketing)/page";

describe("product crops", () => {
  const html = renderToStaticMarkup(createElement(LandingPage));
  const surfaces = [
    ...html.matchAll(/<div inert="" aria-hidden="true" class="([^"]*)" style="width:\d+px/g),
  ].map(([, cls]) => cls);

  it("mark every crop's product surface with the marketing-only crop class", () => {
    expect(surfaces.length).toBeGreaterThan(5);
    for (const cls of surfaces) expect(cls).toMatch(/surface/);
  });

  it("fit the phone Overview's controls, and only there", () => {
    expect(surfaces.filter((cls) => /fitControls/.test(cls))).toHaveLength(1);
  });
});

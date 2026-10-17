import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { landingEvidence } from "@/features/marketing/evidence";
import { OverviewAnalytics } from "./overview-analytics";

function render(targetRoas: number | null) {
  const { workspace, summary, campaignRows } = landingEvidence();
  return renderToStaticMarkup(
    createElement(OverviewAnalytics, {
      workspace: { ...workspace, client: { ...workspace.client, targetRoas } },
      summary,
      campaignRows,
      contextTrend: [],
    }),
  );
}

describe("Overview lead reading", () => {
  it("states the target status beside the lead figure, once", () => {
    const html = render(3.5);
    const lead = html.slice(
      html.indexOf('aria-labelledby="lead-performance-title"'),
      html.indexOf('aria-label="Supporting metrics"'),
    );
    expect(lead).toContain("Needs attention");
    expect(lead).toMatch(/[\d.]+x short of the 3\.50x target/);
    expect(html.split("Needs attention").length - 1).toBe(1);
    expect(html).not.toContain("Target status");
  });

  it("says when the client meets its target", () => {
    const html = render(1);
    expect(html).toContain("On target");
    expect(html).toMatch(/[\d.]+x above the 1\.00x target/);
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CampaignName } from "@/components/ui/campaign-name";
import { splitCampaignName } from "./labels";

const PIPED = "Prospecting | Advantage+ Shopping | Autumn Reset Sale";

describe("splitCampaignName", () => {
  it("takes the last segment as the label and the rest as context", () => {
    expect(splitCampaignName(PIPED)).toEqual({
      primary: "Autumn Reset Sale",
      context: "Prospecting · Advantage+ Shopping",
    });
    expect(splitCampaignName("Leads|Broad|Offer")).toEqual({
      primary: "Offer",
      context: "Leads · Broad",
    });
  });

  it("returns names without two real segments whole", () => {
    for (const name of ["Autumn Reset Sale", "Sale |", "| Sale", " | ", ""])
      expect(splitCampaignName(name), name).toEqual({ primary: name, context: null });
  });
});

describe("CampaignName", () => {
  const render = (props: Parameters<typeof CampaignName>[0]) =>
    renderToStaticMarkup(createElement(CampaignName, props));

  it("shows context above the label, with the full name as title and accessible text", () => {
    const html = render({ name: PIPED, className: "truncate" });
    expect(html).toContain(`title="${PIPED}"`);
    expect(html).toContain(`<span class="sr-only">${PIPED}</span>`);
    expect(html.indexOf("Prospecting · Advantage+ Shopping")).toBeLessThan(
      html.indexOf(">Autumn Reset Sale<"),
    );
    expect(html.match(/aria-hidden="true"/g)?.length).toBe(2);
  });

  it("keeps a prefix on the label and in the accessible name", () => {
    const html = render({ name: PIPED, prefix: "Campaign · " });
    expect(html).toContain(`<span class="sr-only">Campaign · ${PIPED}</span>`);
    expect(html).toContain(">Campaign · Autumn Reset Sale<");
  });

  it("renders a name without pipes as one line, as before", () => {
    const html = render({ name: "Brand Search", className: "truncate text-ink" });
    expect(html).toBe(
      '<span class="block truncate text-ink" title="Brand Search">Brand Search</span>',
    );
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { landingEvidence } from "./evidence";
import { AUDIT_BODY, AUDIT_SUBJECT, auditMailto, HERO_LEAD } from "./hero";

async function renderLanding(email?: string) {
  if (email !== undefined) vi.stubEnv("NEXT_PUBLIC_CONTACT_EMAIL", email);
  vi.resetModules();
  const { default: LandingPage } = await import("@/app/(marketing)/page");
  const html = renderToStaticMarkup(createElement(LandingPage));
  // The hero is everything before the first section below it.
  return html.slice(0, html.indexOf('id="product"'));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("audit request", () => {
  it("is a mailto with the subject and a body asking for the agency's details", () => {
    const href = auditMailto("hello@ad-analyst.example")!;
    const url = new URL(href);
    expect(url.protocol).toBe("mailto:");
    expect(url.pathname).toBe("hello@ad-analyst.example");
    expect(url.searchParams.get("subject")).toBe(AUDIT_SUBJECT);
    expect(AUDIT_SUBJECT).toBe("Wasted-spend audit request");
    expect(url.searchParams.get("body")).toBe(AUDIT_BODY);
    for (const ask of ["Agency name:", "Number of client ad accounts:", "A good time to talk:"])
      expect(AUDIT_BODY).toContain(ask);
    expect(href).not.toMatch(/[\s+]/);
  });

  it("does not exist without an address", () => {
    expect(auditMailto(null)).toBeNull();
  });
});

describe("landing hero", () => {
  it("leads with the audit, then the demo as a text link, when an address is set", async () => {
    const hero = await renderLanding("hello@ad-analyst.example");
    const audit = hero.indexOf("Get a free wasted-spend audit");
    const demo = hero.indexOf("Try the demo");
    expect(audit).toBeGreaterThan(-1);
    expect(demo).toBeGreaterThan(audit);
    expect(hero).toMatch(
      /<a href="mailto:hello@ad-analyst\.example\?subject=Wasted-spend%20audit%20request&amp;body=[^"]+" class="[^"]*button[^"]*">Get a free wasted-spend audit<\/a>/,
    );
    expect(hero).toMatch(/<a class="[^"]*textLink[^"]*" href="\/insights">Try the demo/);
  });

  it("hides the audit without an address and keeps the demo as the primary", async () => {
    const hero = await renderLanding("");
    expect(hero).not.toContain("audit");
    expect(hero).not.toContain("mailto:");
    expect(hero).toMatch(/<a class="[^"]*button[^"]*" href="\/insights">Try the demo<\/a>/);
  });

  it("shows the Overview behind a compact zero-conversion finding", async () => {
    const hero = await renderLanding();
    const { zeroConversion } = landingEvidence();
    const card = hero.slice(hero.lastIndexOf('role="img"'));
    expect(hero).toContain(HERO_LEAD);
    expect(hero).toContain('aria-label="Ad Analyst Overview for Luxe Skin Co.');
    expect(card).toContain(zeroConversion.headline);
    expect(zeroConversion.headline).toContain("£638");
    expect(card).toContain(`title="${zeroConversion.entity.name}"`);
    expect(card).toContain(">Prospecting · Lookalike 5–10%<");
    expect(card).toContain(">Overnight Repair Cream<");
    expect(card.match(/<dt/g)?.length).toBe(3);
    expect(card).toContain("Suggested action");
    expect(card).toContain(zeroConversion.action);
    expect(hero).not.toContain("Why this was flagged");
    expect(hero).not.toContain("Now against the previous period");
    // The only other h1s are the Overview page headers inside the inert crops.
    expect(hero.match(/<h1 id="landing-title"/g)?.length).toBe(1);
    expect(hero.match(/<h1/g)?.length).toBe(3);
  });

  it("renders the Overview crops at their final CSS scale, visible without JavaScript", async () => {
    const hero = await renderLanding();
    expect(hero.match(/container-type:inline-size/g)?.length).toBe(2);
    expect(hero).toContain(
      "transform:scale(tan(atan2(100cqw, 1136px))) translate(0px, 0px);opacity:1",
    );
    expect(hero).toContain(
      "transform:scale(tan(atan2(100cqw, 350px))) translate(-14px, -16px);opacity:1",
    );
    expect(hero).not.toMatch(/opacity:0/);
  });
});

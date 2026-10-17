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

  it("shows the seeded zero-conversion finding whole, from the real component", async () => {
    const hero = await renderLanding();
    const { zeroConversion } = landingEvidence();
    expect(hero).toContain(HERO_LEAD);
    expect(hero).toContain(zeroConversion.headline);
    expect(zeroConversion.headline).toContain("£638");
    expect(hero).toContain("Suggested action");
    expect(hero).toContain(zeroConversion.action);
    expect(hero).toContain("Why this was flagged");
    expect(hero).not.toContain("Ad Analyst Overview");
    expect(hero.match(/<h1/g)?.length).toBe(1);
  });
});

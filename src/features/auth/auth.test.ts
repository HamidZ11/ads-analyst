import { describe, expect, it } from "vitest";
import { appMode, sessionCookieOptions, signupsAllowed } from "@/lib/supabase/config";
import { readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { APP_PATHS } from "@/lib/routes";
import { accessDecision, isAppPath, isPublicPath } from "./access";
import { signInFailureMessage, signInLinkOrigin, validEmail } from "./messages";

describe("deployment mode", () => {
  it("uses Supabase when its URL and publishable key are set", () => {
    expect(
      appMode({
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
        NODE_ENV: "production",
      }),
    ).toEqual({
      kind: "supabase",
      url: "https://x.supabase.co",
      publishableKey: "sb_publishable_x",
    });
    expect(
      appMode({
        NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        NODE_ENV: "production",
      }).kind,
    ).toBe("supabase");
  });

  it("serves demo data only when asked to, or in development", () => {
    expect(appMode({ NODE_ENV: "development" }).kind).toBe("demo");
    expect(appMode({ NODE_ENV: "test" }).kind).toBe("demo");
    expect(appMode({ NODE_ENV: "production", AD_ANALYST_DEMO_MODE: "true" }).kind).toBe("demo");
  });

  it("refuses to fall back to demo data in a production build without configuration", () => {
    expect(appMode({ NODE_ENV: "production" }).kind).toBe("unconfigured");
    expect(
      appMode({ NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" })
        .kind,
    ).toBe("unconfigured");
  });

  it("allows sign-ups unless switched off", () => {
    expect(signupsAllowed({})).toBe(true);
    expect(signupsAllowed({ AD_ANALYST_ALLOW_SIGNUPS: "false" })).toBe(false);
  });
});

describe("route access", () => {
  it("redirects signed-out page requests to sign-in and answers APIs with 401", () => {
    for (const path of [...APP_PATHS, "/clients/import", "/overview/anything"])
      expect(accessDecision(path, false), path).toBe("redirect_to_sign_in");
    expect(accessDecision("/api/import", false)).toBe("unauthorized");
    expect(accessDecision("/api/ask", false)).toBe("unauthorized");
  });

  it("allows signed-in sessions everywhere and sends them to the app from sign-in and the site root", () => {
    for (const path of ["/overview", "/campaigns", "/api/import", "/auth/callback", "/pricing"])
      expect(accessDecision(path, true), path).toBe("allow");
    expect(accessDecision("/sign-in", true)).toBe("redirect_app");
    expect(accessDecision("/", true)).toBe("redirect_app");
  });

  it("keeps the marketing pages public and exact", () => {
    expect(accessDecision("/", false)).toBe("allow");
    expect(accessDecision("/pricing", false)).toBe("allow");
    expect(isPublicPath("/pricing/anything")).toBe(false);
    expect(isPublicPath("/pricing-lab")).toBe(false);
  });

  it("lets unknown URLs through to a real 404 instead of sending them to sign-in", () => {
    for (const path of [
      "/nope",
      "/pricing/anything",
      "/pricing-lab",
      "/insights-lab",
      "/import",
    ])
      expect(accessDecision(path, false), path).toBe("allow");
    expect(isAppPath("/overviewing")).toBe(false);
    expect(isAppPath("/clients/import")).toBe(true);
  });

  it("serves robots.txt and the sitemap to signed-out crawlers", () => {
    expect(accessDecision("/robots.txt", false)).toBe("allow");
    expect(accessDecision("/sitemap.xml", false)).toBe("allow");
  });

  it("classifies every page in src/app as public or as an app page", () => {
    const appDir = join(process.cwd(), "src/app");
    const pages = readdirSync(appDir, { recursive: true, encoding: "utf8" })
      .filter((file) => /(^|[\\/])page\.tsx$/.test(file))
      .map((file) => {
        const segments = relative(appDir, join(appDir, file))
          .split(sep)
          .slice(0, -1)
          .filter((segment) => !/^\(.*\)$/.test(segment));
        return `/${segments.join("/")}`;
      });
    expect(pages.length).toBeGreaterThan(5);
    for (const page of pages)
      expect(isPublicPath(page) || isAppPath(page), `${page} is unclassified`).toBe(true);
  });

  it("keeps sign-in and the email callback public", () => {
    expect(accessDecision("/sign-in", false)).toBe("allow");
    expect(accessDecision("/auth/callback", false)).toBe("allow");
    expect(isPublicPath("/sign-in-elsewhere")).toBe(false);
    expect(isPublicPath("/signin")).toBe(false);
  });
});

describe("sign-in messages", () => {
  it("validates email addresses", () => {
    expect(validEmail("ana@agency.test")).toBe(true);
    for (const bad of ["", "ana", "ana@", "@agency.test", "a b@c.d", `${"a".repeat(250)}@b.cd`])
      expect(validEmail(bad)).toBe(false);
  });

  it("never reveals whether an address has an account", () => {
    expect(signInFailureMessage({ code: "signup_disabled" })).toBeNull();
    expect(signInFailureMessage({ code: "otp_disabled" })).toBeNull();
    expect(signInFailureMessage({ code: "user_not_found" })).toBeNull();
    expect(signInFailureMessage({ status: 429 })).toMatch(/Too many/);
    expect(signInFailureMessage({ status: 500, code: "unexpected_failure" })).toMatch(
      /couldn't send/,
    );
  });
});

describe("session cookies and sign-in links", () => {
  it("keeps session cookies away from page scripts, and on HTTPS in production", () => {
    expect(sessionCookieOptions({ NODE_ENV: "production" })).toEqual({
      httpOnly: true,
      secure: true,
    });
    expect(sessionCookieOptions({ NODE_ENV: "development" })).toEqual({
      httpOnly: true,
      secure: false,
    });
  });

  it("sends sign-in links to the configured origin", () => {
    const request = "https://forged.example";
    for (const NODE_ENV of ["production", "development"])
      expect(
        signInLinkOrigin({ NODE_ENV, NEXT_PUBLIC_SITE_URL: "https://app.example/" }, request),
      ).toBe("https://app.example");
    expect(
      signInLinkOrigin(
        { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "http://localhost:3000" },
        request,
      ),
    ).toBe("http://localhost:3000");
  });

  it("never builds a production sign-in link from request headers", () => {
    expect(signInLinkOrigin({ NODE_ENV: "production" }, "https://forged.example")).toBeNull();
    expect(
      signInLinkOrigin(
        { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" },
        "https://forged.example",
      ),
    ).toBeNull();
    expect(signInLinkOrigin({ NODE_ENV: "development" }, "http://localhost:3000")).toBe(
      "http://localhost:3000",
    );
  });
});

import { describe, expect, it } from "vitest";
import { appMode, signupsAllowed } from "@/lib/supabase/config";
import { accessDecision, isPublicPath } from "./access";
import { signInFailureMessage, validEmail } from "./messages";

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
    for (const path of [
      "/overview",
      "/campaigns",
      "/clients/import",
      "/settings",
      "/insights-lab",
    ])
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
    expect(accessDecision("/pricing/anything", false)).toBe("redirect_to_sign_in");
    expect(accessDecision("/pricing-lab", false)).toBe("redirect_to_sign_in");
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
